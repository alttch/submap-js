class RegexSubscription<C> {
  regex: RegExp;
  sub: Subscription<C>;
  constructor(regex: RegExp) {
    this.regex = regex;
    this.sub = new Subscription();
  }
}

class Subscription<C> {
  subscribers: Set<C>;
  subtopics: Map<string, Subscription<C>>;
  subtopics_by_regex: Array<RegexSubscription<C>>;
  subtopics_any?: Subscription<C>;
  sub_any: Set<C>;

  constructor() {
    this.subscribers = new Set();
    this.subtopics = new Map();
    this.subtopics_by_regex = [];
    this.sub_any = new Set();
  }

  isEmpty(): boolean {
    return (
      this.subscribers.size === 0 &&
      this.subtopics.size === 0 &&
      this.subtopics_by_regex.length === 0 &&
      this.subtopics_any === undefined &&
      this.sub_any.size === 0
    );
  }
}

export class SubMap<C> {
  subscriptions: Subscription<C>;
  subscribed_topics: Map<C, Set<string>>;
  #subscription_count: number;
  #separator: string;
  #regex_prefix?: string;
  #match_any: Set<string>;
  #wildcard: Set<string>;

  constructor() {
    this.subscriptions = new Subscription();
    this.subscribed_topics = new Map();
    this.#subscription_count = 0;
    this.#separator = "/";
    this.#match_any = new Set(["?"]);
    this.#wildcard = new Set(["*"]);
  }

  separator(separator: string): SubMap<C> {
    this.#separator = separator;
    return this;
  }

  regexPrefix(prefix: string): SubMap<C> {
    this.#regex_prefix = prefix;
    return this;
  }

  matchAny(match: string | Array<string>): SubMap<C> {
    if (Array.isArray(match)) {
      this.#match_any = new Set(match);
    } else {
      this.#match_any = new Set([match]);
    }
    return this;
  }

  wildcard(wildcard: string | Array<string>): SubMap<C> {
    if (Array.isArray(wildcard)) {
      this.#wildcard = new Set(wildcard);
    } else {
      this.#wildcard = new Set([wildcard]);
    }
    return this;
  }

  listClients(): Array<C> {
    return Array.from(this.subscriptions.subscribers);
  }

  listTopics(client: C): Array<string> {
    return Array.from(this.subscribed_topics.get(client) || []);
  }

  isEmpty(): boolean {
    return this.subscribed_topics.size === 0;
  }

  registerClient(client: C): boolean {
    if (this.subscribed_topics.has(client)) {
      return false;
    }
    this.subscribed_topics.set(client, new Set());
    return true;
  }

  unregisterClient(client: C): boolean {
    const client_topics = this.subscribed_topics.get(client);
    if (client_topics === undefined) {
      return false;
    }
    for (const topic of client_topics) {
      unsubscribe_rec(
        this.subscriptions,
        topic.split(this.#separator),
        0,
        client,
        this.#wildcard,
        this.#match_any,
        this.#regex_prefix
      );
      this.#subscription_count -= 1;
    }
    this.subscribed_topics.delete(client);
    return true;
  }

  subscribe(topic: string, client: C): boolean {
    const client_topics = this.subscribed_topics.get(client);
    if (client_topics === undefined) {
      return false;
    }
    if (!client_topics.has(topic)) {
      subscribe_rec(
        this.subscriptions,
        topic.split(this.#separator),
        0,
        client,
        this.#wildcard,
        this.#match_any,
        this.#regex_prefix
      );
      client_topics.add(topic);
      this.#subscription_count += 1;
    }
    return true;
  }

  unsubscribe(topic: string, client: C): boolean {
    const client_topics = this.subscribed_topics.get(client);
    if (client_topics === undefined) {
      return false;
    }
    if (client_topics.has(topic)) {
      unsubscribe_rec(
        this.subscriptions,
        topic.split(this.#separator),
        0,
        client,
        this.#wildcard,
        this.#match_any,
        this.#regex_prefix
      );
      client_topics.delete(topic);
      this.#subscription_count -= 1;
    }
    return true;
  }

  unsubscribeAll(client: C): boolean {
    const client_topics = this.subscribed_topics.get(client);
    if (client_topics === undefined) {
      return false;
    }
    for (const topic of client_topics) {
      unsubscribe_rec(
        this.subscriptions,
        topic.split(this.#separator),
        0,
        client,
        this.#wildcard,
        this.#match_any,
        this.#regex_prefix
      );
    }
    this.#subscription_count -= client_topics.size;
    client_topics.clear();
    return true;
  }

  getSubscribers(topic: string): Set<C> {
    const result = new Set<C>();
    get_subscribers_rec(
      this.subscriptions,
      topic.split(this.#separator),
      0,
      this.#regex_prefix,
      result
    );
    return result;
  }

  isSubscribed(topic: string): boolean {
    return is_subscribed_rec(
      this.subscriptions,
      topic.split(this.#separator),
      0,
      this.#regex_prefix
    );
  }

  subscriptionCount(): number {
    return this.#subscription_count;
  }

  clientCount(): number {
    return this.subscribed_topics.size;
  }
}

function subscribe_rec<C>(
  subscription: Subscription<C>,
  parts: string[],
  index: number,
  client: C,
  wildcard: Set<string>,
  matchAny: Set<string>,
  regexPrefix?: string
) {
  if (index < parts.length) {
    const topic = parts[index];

    if (wildcard.has(topic)) {
      subscription.sub_any.add(client);
    } else if (matchAny.has(topic)) {
      if (!subscription.subtopics_any) {
        subscription.subtopics_any = new Subscription();
      }
      subscribe_rec(
        subscription.subtopics_any,
        parts,
        index + 1,
        client,
        wildcard,
        matchAny,
        regexPrefix
      );
    } else if (regexPrefix && topic.startsWith(regexPrefix)) {
      const regexStr = topic.slice(regexPrefix.length);
      try {
        const regex = new RegExp(regexStr);
        let regexSub = subscription.subtopics_by_regex.find(
          (rs) => rs.regex.source === regex.source
        );
        if (!regexSub) {
          regexSub = {
            regex,
            sub: new Subscription()
          };
          subscription.subtopics_by_regex.push(regexSub);
        }
        subscribe_rec(
          regexSub.sub,
          parts,
          index + 1,
          client,
          wildcard,
          matchAny,
          regexPrefix
        );
      } catch {}
    } else {
      if (!subscription.subtopics.has(topic)) {
        subscription.subtopics.set(topic, new Subscription());
      }
      subscribe_rec(
        subscription.subtopics.get(topic)!,
        parts,
        index + 1,
        client,
        wildcard,
        matchAny,
        regexPrefix
      );
    }
  } else {
    subscription.subscribers.add(client);
  }
}

function unsubscribe_rec<C>(
  subscription: Subscription<C>,
  parts: string[],
  index: number,
  client: C,
  wildcard: Set<string>,
  matchAny: Set<string>,
  regexPrefix?: string
) {
  if (index < parts.length) {
    const topic = parts[index];

    if (wildcard.has(topic)) {
      subscription.sub_any.delete(client);
    } else if (matchAny.has(topic)) {
      if (subscription.subtopics_any) {
        unsubscribe_rec(
          subscription.subtopics_any,
          parts,
          index + 1,
          client,
          wildcard,
          matchAny,
          regexPrefix
        );
        if (subscription.subtopics_any.isEmpty()) {
          subscription.subtopics_any = undefined;
        }
      }
    } else if (regexPrefix && topic.startsWith(regexPrefix)) {
      const regexStr = topic.slice(regexPrefix.length);
      try {
        const regex = new RegExp(regexStr);
        const pos = subscription.subtopics_by_regex.findIndex(
          (rs) => rs.regex.source === regex.source
        );
        if (pos !== -1) {
          const sub = subscription.subtopics_by_regex[pos].sub;
          unsubscribe_rec(
            sub,
            parts,
            index + 1,
            client,
            wildcard,
            matchAny,
            regexPrefix
          );
          if (sub.isEmpty()) {
            subscription.subtopics_by_regex.splice(pos, 1);
          }
        }
      } catch {}
    } else {
      const sub = subscription.subtopics.get(topic);
      if (sub) {
        unsubscribe_rec(
          sub,
          parts,
          index + 1,
          client,
          wildcard,
          matchAny,
          regexPrefix
        );
        if (sub.isEmpty()) {
          subscription.subtopics.delete(topic);
        }
      }
    }
  } else {
    subscription.subscribers.delete(client);
  }
}

function get_subscribers_rec<C>(
  subscription: Subscription<C>,
  parts: string[],
  index: number,
  regexPrefix: string | undefined,
  result: Set<C>
) {
  if (index < parts.length) {
    const topic = parts[index];

    for (const client of subscription.sub_any) {
      result.add(client);
    }

    if (regexPrefix && topic.startsWith(regexPrefix)) {
      const regexStr = topic.slice(regexPrefix.length);
      try {
        const regex = new RegExp(regexStr);
        for (const [name, sub] of subscription.subtopics) {
          if (regex.test(name)) {
            get_subscribers_rec(sub, parts, index + 1, regexPrefix, result);
          }
        }
      } catch {}
    } else {
      const sub = subscription.subtopics.get(topic);
      if (sub) {
        get_subscribers_rec(sub, parts, index + 1, regexPrefix, result);
      }
    }

    for (const rs of subscription.subtopics_by_regex) {
      if (rs.regex.test(topic)) {
        get_subscribers_rec(rs.sub, parts, index + 1, regexPrefix, result);
      }
    }

    if (subscription.subtopics_any) {
      get_subscribers_rec(
        subscription.subtopics_any,
        parts,
        index + 1,
        regexPrefix,
        result
      );
    }
  } else {
    for (const client of subscription.subscribers) {
      result.add(client);
    }
  }
}

function is_subscribed_rec<C>(
  subscription: Subscription<C>,
  parts: string[],
  index: number,
  regexPrefix?: string
): boolean {
  if (index < parts.length) {
    const topic = parts[index];

    if (subscription.sub_any.size > 0) {
      return true;
    }

    if (regexPrefix && topic.startsWith(regexPrefix)) {
      const regexStr = topic.slice(regexPrefix.length);
      try {
        const regex = new RegExp(regexStr);
        for (const [name, sub] of subscription.subtopics) {
          if (
            regex.test(name) &&
            is_subscribed_rec(sub, parts, index + 1, regexPrefix)
          ) {
            return true;
          }
        }
      } catch {}
    } else {
      const sub = subscription.subtopics.get(topic);
      if (sub && is_subscribed_rec(sub, parts, index + 1, regexPrefix)) {
        return true;
      }
    }

    for (const rs of subscription.subtopics_by_regex) {
      if (
        rs.regex.test(topic) &&
        is_subscribed_rec(rs.sub, parts, index + 1, regexPrefix)
      ) {
        return true;
      }
    }

    if (
      subscription.subtopics_any &&
      is_subscribed_rec(
        subscription.subtopics_any,
        parts,
        index + 1,
        regexPrefix
      )
    ) {
      return true;
    }
  } else if (subscription.subscribers.size > 0) {
    return true;
  }

  return false;
}
