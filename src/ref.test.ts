import Refs from './ref';

let refs = new Refs();


(() => {
    let a = refs.of(1);
    let count = 0;
    a.listen(() => {
        count++;
    });
    test('ref get', () => {
        expect(a.get()).toBe(1);
        expect(count).toBe(1);
    });
    test('ref set', () => {
        a.set(2);
        expect(a.get()).toBe(2);
        expect(count).toBe(2);
    });
    test('ref clear', () => {
        a.clear();
        expect(a.get()).toBe(1);
        expect(count).toBe(3);
    });
})();


(() => {
    let a = refs.ofComputed(() => a.get());
    test('ref compute circular dependency', () => expect(() => a.get()).toThrow());
})();

(() => {
    let a = refs.of(1);
    let b = refs.of(2);
    let c = refs.ofComputed(() => a.get() + 1);
    let d = refs.ofComputed(() => a.get() + b.get() + 1);

    let acount = 0;
    let bcount = 0;
    let ccount = 0;
    let dcount = 0;
    a.listen(() => acount++);
    b.listen(() => bcount++);
    c.listen(() => ccount++);
    d.listen(() => dcount++);

    test('ref compute get', () => {
        expect(a.get()).toBe(1);
        expect(b.get()).toBe(2);
        expect(c.get()).toBe(a.get() + 1);
        expect(d.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(1);
        expect(bcount).toBe(1);
        expect(ccount).toBe(1);
        expect(dcount).toBe(1);
    });

    test('ref compute set', () => {
        a.set(2);
        expect(a.get()).toBe(2);
        expect(b.get()).toBe(2);
        expect(c.get()).toBe(a.get() + 1);
        expect(d.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(2);
        expect(bcount).toBe(1);
        expect(ccount).toBe(2);
        expect(dcount).toBe(2);
    });

    test('ref compute set 2', () => {
        b.set(3);
        expect(a.get()).toBe(2);
        expect(b.get()).toBe(3);
        expect(c.get()).toBe(a.get() + 1);
        expect(d.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(2);
        expect(bcount).toBe(2);
        expect(ccount).toBe(2);
        expect(dcount).toBe(3);
    });


    test('ref compute clear', () => {
        a.clear();
        expect(a.get()).toBe(1);
        expect(b.get()).toBe(3);
        expect(c.get()).toBe(a.get() + 1);
        expect(d.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(3);
        expect(bcount).toBe(2);
        expect(ccount).toBe(3);
        expect(dcount).toBe(4);
    });

    test('ref compute clear 2', () => {
        b.clear();
        expect(a.get()).toBe(1);
        expect(b.get()).toBe(2);
        expect(c.get()).toBe(a.get() + 1);
        expect(d.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(3);
        expect(bcount).toBe(3);
        expect(ccount).toBe(3);
        expect(dcount).toBe(5);
    });
})();



(() => {
    let a = refs.of(1);
    let b = refs.of(2);
    let c = refs.ofComputed(() => a.get() + b.get() + 1);

    let acount = 0;
    let bcount = 0;
    let ccount = 0;
    a.listen(() => acount++);
    b.listen(() => bcount++);
    c.listen(() => ccount++);

    test('refs not tx', () => {
        a.set(3);
        b.set(3);

        expect(a.get()).toBe(3);
        expect(b.get()).toBe(3);
        expect(c.get()).toBe(a.get() + b.get() + 1);
        expect(acount).toBe(2);
        expect(bcount).toBe(2);
        expect(ccount).toBe(3);
    });
})();


(() => {
    let a = refs.of(1);
    let b = refs.of(2);
    let c = refs.ofComputed(() => a.get() + b.get() + 1);

    let acount = 0;
    let bcount = 0;
    let ccount = 0;
    a.listen(() => acount++);
    b.listen(() => bcount++);
    c.listen(() => {
        ccount++;
    });

    test('refs tx', () => {
        refs.tx(() => {
            a.set(3);
            b.set(3);
        });
        expect(a.get()).toBe(3);
        expect(b.get()).toBe(3);
        expect(c.get()).toBe(a.get() + b.get() + 1);

        expect(acount).toBe(2);
        expect(bcount).toBe(2);
        expect(ccount).toBe(2);
    });
})();



(() => {
    let operator1 = {};
    let operator2 = {};
    let a = refs.of(1, null, [operator1, operator2]);
    test('ref settable', () => {
        expect(a.get()).toBe(1);
        a.set(2, operator1);
        expect(a.get()).toBe(2);
        a.set(3, operator2);
        expect(a.get()).toBe(3);
    });

    test('ref doesn\'t settable 1', () => {
        expect(() => a.set(4)).toThrow();
        expect(a.get()).toBe(3);
    });
    test('ref doesn\'t settable 2', () => {
        expect(() => a.set(4, {})).toThrow();
        expect(a.get()).toBe(3);
    });

})();
