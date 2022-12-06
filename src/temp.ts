interface ListenerData<Listener> {
    target: Object,
    listener: Listener;
    once: boolean;
}

class ListenerContainer<Listener extends Function = Function>{
    private readonly listenerMap = new Map<Listener, ListenerData<Listener>>();
    private listeners: ListenerData<Listener>[] = [];

    public addListener(listener: Listener, target: Object = this): Listener {
        if (this.listenerMap.get(listener)) {
            return undefined;
        }
        let data: ListenerData<Listener> = {
            target: target,
            listener: listener,
            once: false,
        };
        this.listeners.push(data);
        this.listenerMap.set(listener, data);
        return listener;
    }

    public addOnceListener(listener: Listener, target: Object = this): Listener {
        if (this.listenerMap.get(listener)) {
            return undefined;
        }
        let data: ListenerData<Listener> = {
            target: target,
            listener: listener,
            once: true,
        };
        this.listeners.push(data);
        this.listenerMap.set(listener, data);
        return listener;
    }

    public removeListener(listener: Listener): void {
        this.listeners.forEach((data, i) => {
            if (data?.listener == listener) this.mark(data.listener, i);
        });
        this.clearMark();
    }

    public removeAllListener(target: Object): void {
        this.listeners.forEach((data, i) => {
            if (data?.target == target) this.mark(data.listener, i);
        });
        this.clearMark();
    }

    public dispatch(...args) {
        // return this.dispatchIgnoreTarget(null, args);
    }

    public dispatchIgnoreTarget(target: any, args) {
        if (this.listeners.length == 0) return;
        let clear = false;
        this.listeners.forEach((data, i) => {
            try {
                if (target == data?.target) return;
                data.listener.apply(data.target, args);
            } catch (e) {
                clear = true;
                this.mark(data.listener, i);
                console.error(e, data);
            }
            if (data.once) {
                clear = true;
                this.mark(data.listener, i);
            }
        });

        if (clear) {
            console.log('clearMark')
            this.clearMark();
        }
    }

    public count() {
        return this.listeners.length;
    }

    public clear() {
        this.listeners.length = 0;
        this.listenerMap.clear();
    }

    private mark(listener: Listener, index) {
        this.listeners[index] = undefined;
        this.listenerMap.delete(listener);
    }

    private clearMark() {
        this.listeners = this.listeners.filter(data => data);
    }
}


const refDependMap = new Map<Ref, Map<RefComputed, RefComputed>>();

const refDefaultMethodMap = new Map<Ref, Function>();

const scopeMap = new Map<any, RefScope>();

const computeRefQueue: RefComputed[] = [];

const scopeQueue: any[] = [];

const txRefs = [];

let currentScope: any = {};

let cleaning = false;

let transaction = false;

function listen(ref: Ref, scope: any): any {
    scope = getScope(scope);
    getRefScope(scope).listenRefs.push(ref);
    return scope;
}

function clearDepend(ref: Ref): void {
    if (cleaning) return;
    if (transaction) {
        txRefs.push(ref);
        return;
    }
    let refMap = scanRef(ref);
    if (refMap.size == 0) return;
    cleaning = true;
    refMap.forEach(r => r['__clear']());
    refMap.forEach(r => r['__notify']());
    cleaning = false;
    return;
}

function clearDepends(): void {
    if (cleaning) return;
    let refMap = new Map();
    txRefs.forEach(ref => scanRef(ref, refMap));
    if (refMap.size == 0) return;
    cleaning = true;
    refMap.forEach(r => r['__clear']());
    refMap.forEach(r => r['__notify']());
    txRefs.length = 0;
    cleaning = false;
}

function scanRef(ref: Ref, collection: Map<RefComputed, RefComputed> = new Map()): Map<RefComputed, RefComputed> {
    let map = refDependMap.get(ref);
    if (map) {
        map.forEach(r => {
            if (collection.get(r)) return;
            collection.set(r, r);
            scanRef(r, collection);
        });
        map.clear();
    }
    return collection;
}

function addDepend(ref: Ref) {
    let currentRef = computeRefQueue[computeRefQueue.length - 1];
    if (currentRef) {
        if (currentRef == ref) return;
        let refMap = computeIfAbsent(refDependMap, ref, (k) => {
            return new Map();
        });
        refMap.set(currentRef, currentRef);
        getRefScope(currentRef.getScope()).refMap.set(currentRef, refMap);
    }
}

function getScope(scope?: any): any {
    return scope || currentScope;
}

function getRefScope(scope: any): RefScope {
    return computeIfAbsent(scopeMap, scope, (k) => {
        return {
            listenRefs: []
            , refMap: new Map()
        };
    });
}

function computeIfAbsent<K, V>(map: Map<K, V>, key: K, callable: ((key: K) => V)): V {
    let value = map.get(key);
    if (value == undefined) {
        map.set(key, (value = callable(key)));
    }
    return value;
}


interface RefCacheConfig<Value> {
    // Cache name
    name: string;
    // Cache value in localStorage or sessionStorage
    local?: boolean;
    value: Value;
}

type RefListener<Value> = (value: Value, oldValue: Value) => void;

interface RefScope {
    listenRefs: Ref[];
    refMap: Map<RefComputed, Map<RefComputed, RefComputed>>;
}

interface RefStorage {
    getItem(key: string): string;
    setItem(key: string, value: string);
}

class Refs {

    private localStorage: RefStorage = { getItem(key) { return null; }, setItem(key, value) { } };

    private sessionStorage: RefStorage = { getItem(key) { return null; }, setItem(key, value) { } };

    /**
     * 
     * @param value 
     * @param scope 
     * @param operators Settable operator.
     * @returns RefValue
     */
    public of<Value = any, Scope = any>(value: Value, scope?: Scope, operators?: any[]): RefValue<Value, Scope> {
        return new RefValue<Value, Scope>(getScope(scope), value, operators);
    }

    public ofComputed<Value = any, Scope = any>(provider: (() => Value), scope?: Scope): RefComputed<Value, Scope> {
        return new RefComputed<Value, Scope>(getScope(scope), provider);
    }

    /**
     * Create cacheable Ref.
     */
    public ofCache<Value = any, Scope = any>(config: RefCacheConfig<Value>, scope?: Scope, operators?: any[]): RefValue<Value, Scope> {
        let storage = config.local ? this.localStorage : this.sessionStorage;
        let value: Value;
        let cache: string = storage.getItem(config.name);
        if (cache) {
            try {
                value = JSON.parse(cache);
            } catch (e) {
                console.warn(e);
            }
        }
        if (value == undefined) {
            value = config.value;
        }
        let ref = this.of(value, scope, operators);
        ref.listen(() => {
            storage.setItem(config.name, ref.stringify());
        });
        return ref;
    }

    /**
     * Operate any ref in scope.
     */
    public runInScope(runnable: Function, scope: any) {
        try {
            scopeQueue.push(currentScope);
            currentScope = scope;
            runnable();
        } finally {
            currentScope = scopeQueue.pop();
        }
    }

    /**
     * Remove all dependencies and listener by scope.
     */
    public off(scope: any) {
        let scopeContext = scopeMap.get(scope);
        if (scopeContext) {
            scopeContext.refMap.forEach((map, ref) => {
                map.delete(ref);
                refDefaultMethodMap.delete(ref);
            });
            scopeContext.listenRefs.forEach((ref) => {
                ref.interrupt(scope);
            });
            scopeContext.listenRefs.length = 0;
            scopeContext.refMap.clear();

            scopeMap.delete(scope);
        }
    }

    public setLocalStorage(storage: RefStorage) {
        this.localStorage = storage;
    }

    public setSessionStorage(storage: RefStorage) {
        this.sessionStorage = storage;
    }

    /** 
     * Post notifications after processing all value updates. 
     */
    public tx(runnable: Function) {
        transaction = true;
        try {
            runnable();
        } finally {
            transaction = false;
            clearDepends();
        }
    }
}

abstract class Ref<Value = any, Scope = any>  {

    protected readonly listeners = new ListenerContainer<RefListener<Value>>();

    protected oldValue: Value;

    protected value: Value;

    protected valueStringify: string;

    constructor(
        protected readonly scope: Scope
    ) {
    }

    public abstract get(): Value;

    public stringify(): string {
        return this.valueStringify;
    }

    public getScope(): Scope {
        return this.scope;
    }

    public listen(listener: RefListener<Value>, scope?: Scope) {
        scope = listen(this, scope);
        listener(this.get(), this.oldValue);
        this.listeners.addListener(listener, scope);
    }

    public interrupt(scope: Scope) {
        this.listeners.removeAllListener(scope);
    }

    protected setValue(value: Value) {
        if (this.doSetValue(value)) {
            clearDepend(this);
            this.listeners.dispatch(this.value);
        }
    }

    protected doSetValue(value: Value): boolean {
        let stringify = JSON.stringify(value);
        if (this.valueStringify === stringify) return false;
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    }
}

class RefValue<Value = any, Scope = any> extends Ref<Value, Scope> {
    constructor(
        scope: Scope
        , protected provider: Value
        , /** settable operator */
        protected operators?: any[]
    ) {
        super(scope);
        this.doSetValue(provider);
    }

    public get(): Value {
        addDepend(this);
        return this.value;
    }

    public clear(): void {
        this.set(this.provider);
    }

    public set(value: Value, operator?: any) {
        if ((this.operators?.length || 0) > 0 && this.operators.indexOf(operator) == -1) {
            console.error('The operator does\'t settable!', operator);
            throw new Error('The operator does\'t settable!');
        }
        this.setValue(value);
    }
}

class RefComputed<Value = any, Scope = any> extends Ref<Value, Scope>  {

    private dirty = false;

    constructor(
        scope: Scope
        , protected provider: (() => Value)
    ) {
        super(scope);
        this['__clear'] = () => {
            this.valueStringify = undefined;
            this.dirty = false;
        };
        this['__notify'] = () => {
            if (this.listeners.count() == 0) return;
            this.get(true);
        };
    }

    protected setValue(value: Value) {
        if (this.doSetValue(value)) {
            if (this.dirty) {
                clearDepend(this);
            }
            this.listeners.dispatch(this.value);
            this.dirty = true;
        }
    }

    public get(force = false) {
        addDepend(this);
        if (this.valueStringify == undefined || force) {
            let value;
            try {
                computeRefQueue.push(this);
                value = this.provider()
            } finally {
                computeRefQueue.pop();
            }
            this.setValue(value);
        }
        return this.value;
    }
}




let refs = new Refs();
let s = {};
let bfn = () => /*b*/a.get() + 1;
let cfn = () => /*c*/b.get() + 1;
let dfn = () => /*d*/c.get() + 1;
let efn = () => /*e*/b.get() + 1;


let a = refs.of(1);
let b = refs.ofComputed(bfn);
let c = refs.ofComputed(cfn);
let d = refs.ofComputed(dfn, s);
let e = refs.ofComputed(efn);
let count = 0;
d.listen(() => {
    count++;
});


// verifyLoop(1000000);

loop(1000000);

function verifyLoop(max) {
    count = 0;
    console.log('verifyLoop start')
    let t = Date.now();
    while (max-- > 0) {
        a.set(max);
        verify('a', a.get(), () => max);
        verify('b', b.get(), bfn);
        verify('c', c.get(), cfn);
        verify('d', d.get(), dfn);
        verify('e', e.get(), efn);
    }
    console.log(Date.now() - t, max, count);
}

function verify(name, value, fn) {
    let expected = fn();
    if (value != expected) throw new Error(`${name} ${value} not equals ${expected}`);
}

function loop(max) {
    count = 0;
    console.log('loop start')
    let t = Date.now();
    while (max-- > 0) {
        a.set(max);
    }
    console.log(Date.now() - t, max, count);
}