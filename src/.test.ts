import { SubMap } from "./submap";

describe("SubMap Tests", () => {
  test("test_sub", () => {
    let smap = new SubMap().matchAny("+").wildcard("#");
    let client1 = "test1";
    expect(smap.registerClient(client1)).toBeTruthy();
    expect(smap.subscribe("unit/tests/test1", client1)).toBeTruthy();
    expect(smap.subscribe("unit/tests/test2", client1)).toBeTruthy();
    expect(smap.subscribe("unit/tests/test3", client1)).toBeTruthy();
    expect(smap.unregisterClient(client1)).toBeTruthy();

    let client2 = "test2";
    expect(smap.registerClient(client2)).toBeTruthy();
    expect(smap.subscribe("unit/+/test2", client2)).toBeTruthy();
    expect(smap.subscribe("unit/zzz/test2", client2)).toBeTruthy();
    expect(smap.unsubscribe("unit/zzz/test2", client2)).toBeTruthy();

    let client3 = "test3";
    expect(smap.registerClient(client3)).toBeTruthy();
    expect(smap.subscribe("unit/+/+/+", client3)).toBeTruthy();
    expect(smap.unsubscribe("unit/+/+/+", client3)).toBeTruthy();

    let client4 = "test4";
    expect(smap.registerClient(client4)).toBeTruthy();
    expect(smap.subscribe("unit/#", client4)).toBeTruthy();

    let subs = smap.getSubscribers("unit/tests/test2");
    expect(subs.size).toBe(2);
    expect(subs.has(client2)).toBeTruthy();
    expect(subs.has(client4)).toBeTruthy();

    subs = smap.getSubscribers("unit/tests");
    expect(subs.size).toBe(1);

    expect(smap.subscribe("#", client4)).toBeTruthy();
    subs = smap.getSubscribers("unit");
    expect(subs.size).toBe(1);
    expect(subs.has(client4)).toBeTruthy();

    expect(smap.unsubscribe("#", client4)).toBeTruthy();
    subs = smap.getSubscribers("unit");
    expect(subs.size).toBe(0);

    smap.unregisterClient(client1);
    smap.unregisterClient(client2);
    smap.unregisterClient(client3);
    smap.unregisterClient(client4);

    expect(smap.registerClient(client1)).toBeTruthy();
    expect(smap.registerClient(client2)).toBeTruthy();
    expect(smap.subscribe("unit/tests/#", client1)).toBeTruthy();
    expect(smap.subscribe("unit/+/#", client2)).toBeTruthy();

    subs = smap.getSubscribers("unit");
    expect(subs.size).toBe(0);

    subs = smap.getSubscribers("unit/tests");
    expect(subs.size).toBe(0);

    subs = smap.getSubscribers("unit/tests/xxx");
    expect(subs.has(client1)).toBeTruthy();
    expect(subs.has(client2)).toBeTruthy();
    expect(subs.size).toBe(2);

    subs = smap.getSubscribers("unit/tests/xxx/yyy");
    expect(subs.size).toBe(2);
    expect(subs.has(client1)).toBeTruthy();
    expect(subs.has(client2)).toBeTruthy();

    expect(smap.subscribe("unit/#", client1)).toBeTruthy();
    subs = smap.getSubscribers("unit");
    expect(subs.size).toBe(0);

    subs = smap.getSubscribers("unit/tests");
    expect(subs.size).toBe(1);

    expect(smap.subscribe("#", client1)).toBeTruthy();
    subs = smap.getSubscribers("unit");
    expect(subs.size).toBe(1);
    subs = smap.getSubscribers("unit/tests");
    expect(subs.size).toBe(1);

    smap.unregisterClient(client1);
    smap.unregisterClient(client2);
    expect(smap.subscriptions.isEmpty()).toBeTruthy();
  });

  test("test_match_any", () => {
    let smap = new SubMap().matchAny("+").wildcard("#");
    let client1 = "client1";

    smap.registerClient(client1);
    expect(smap.getSubscribers("abc/xxx").size).toBe(0);

    smap.subscribe("+/xxx", client1);
    expect(smap.getSubscribers("abc/xxx").size).toBe(1);
    expect(smap.getSubscribers("unix/zzz/xxx/222").size).toBe(0);

    smap.subscribe("+/zzz/+/222", client1);
    expect(smap.getSubscribers("unix/zzz/xxx/222").size).toBe(1);
  });

  test("test_match_regex", () => {
    let smap = new SubMap().matchAny("+").wildcard("#").regexPrefix("~");
    let client1 = "client1";

    smap.registerClient(client1);
    expect(smap.getSubscribers("test1/xxx").size).toBe(0);

    smap.subscribe("~^test\\d+$/xxx", client1);
    expect(smap.getSubscribers("test1/xxx").size).toBe(1);
    expect(smap.getSubscribers("test2/xxx").size).toBe(1);
    expect(smap.getSubscribers("test3333/xxx").size).toBe(1);
    expect(smap.getSubscribers("test3333a/xxx").size).toBe(0);

    let client2 = "client2";
    smap.registerClient(client2);
    smap.subscribe("~^test\\d+$/xxx", client2);
    expect(smap.getSubscribers("test1/xxx").size).toBe(2);
    expect(smap.getSubscribers("test2/xxx").size).toBe(2);
    expect(smap.getSubscribers("test3333/xxx").size).toBe(2);
    expect(smap.getSubscribers("test3333a/xxx").size).toBe(0);

    smap.unsubscribe("~^test\\d+$/xxx", client1);
    expect(smap.getSubscribers("test1/xxx").size).toBe(1);

    smap.unsubscribe("~^test\\d+$/xxx", client2);
    expect(smap.getSubscribers("test1/xxx").size).toBe(0);
  });
});

