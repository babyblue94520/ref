import ListenerContainer from './listener';

const refDependMap = new Map<Ref, Map<Ref, Ref>>();

const scopeMap = new Map<any, RefScope>();

const computeRefQueue: Ref[] = [];

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
    cleaning = true;
    let refMap = scanRef(ref);
    refMap.forEach((v, r) => {
        r.clear();
    });
    refMap.forEach((v, r) => {
        r.get();
    });
    cleaning = false;
}

function clearDepends(): void {
    if (cleaning) return;
    cleaning = true;
    let refMap = new Map();
    txRefs.forEach(ref => {
        scanRef(ref, refMap);
    });
    refMap.forEach((v, r) => {
        r.clear();
    });
    refMap.forEach((v, r) => {
        r.get();
    });
    txRefs.length = 0;
    cleaning = false;
}

function scanRef(ref: Ref, collection: Map<Ref, any> = new Map()): Map<Ref, any> {
    let map = refDependMap.get(ref);
    if (map) {
        let s = map.size;
        map.forEach(r => {
            collection.set(r, true);
            scanRef(r, collection);
        });
        map.clear();
    }
    return collection;
}

function addDepend(ref: Ref) {
    let currentRef = computeRefQueue[computeRefQueue.length - 1];
    if (currentRef) {
        if (currentRef == ref) {
            throw new Error('Doesn\'t depend self!');
        }
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


export interface RefCacheConfig<Value> {
    // Cache name
    name: string;
    // Cache value in localStorage or sessionStorage
    local?: boolean;
    value: Value;
}

export type RefListener<Value> = (value: Value, oldValue: Value) => void;

export interface RefScope {
    listenRefs: Ref[];
    refMap: Map<Ref, Map<Ref, Ref>>;
}

export interface RefStorage {
    getItem(key: string): string;
    setItem(key: string, value: string);
}

export default class Refs {

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
    public ofCache<Value = any, Scope = any>(config: RefCacheConfig<Value>, scope?: Scope): RefCache<Value, Scope> {
        let storage = config.local ? this.localStorage : this.sessionStorage;
        let value: any = storage.getItem(config.name);
        if (value) {
            try {
                value = JSON.parse(value);
            } catch (e) {
                console.warn(e);
                value = undefined;
            }
        }
        if (value == undefined) {
            value = config.value;
        }
        return new RefCache(scope, value, (str) => {
            storage.setItem(config.name, str);
        });
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


export abstract class Ref<Value = any, Scope = any>  {

    protected readonly listeners = new ListenerContainer<RefListener<Value>>();

    protected oldValue: Value;

    protected value: Value;

    protected valueStringify: string;

    constructor(
        protected readonly scope: Scope
    ) {
    }

    public abstract get(): Value;

    public abstract clear(): void;

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

    protected setValue(value: Value): boolean {
        let stringify = JSON.stringify(value);
        if (this.valueStringify === stringify) return false;
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    }

    protected dispatch() {
        clearDepend(this);
        this.listeners.dispatch(this.value);
    }
}


export class RefValue<Value = any, Scope = any> extends Ref<Value, Scope> {
    constructor(
        scope: Scope
        , protected provider: Value
        , /** settable operator */
        protected operators?: any[]
    ) {
        super(scope);
        this.setValue(provider);
    }

    public get(): Value {
        addDepend(this);
        return this.value;
    }

    public set(value: Value, operator?: any) {
        if ((this.operators?.length || 0) > 0 && this.operators.indexOf(operator) == -1) {
            console.error('The operator does\'t settable!', operator);
            throw new Error('The operator does\'t settable!');
        }
        if (this.setValue(value)) {
            this.dispatch();
        }
    }

    public clear(): void {
        this.set(this.provider);
    }
}


export class RefComputed<Value = any, Scope = any> extends Ref<Value, Scope>  {
    constructor(
        scope: Scope
        , protected provider: (() => Value)
    ) {
        super(scope);
    }

    public get() {
        if (this.valueStringify == undefined) {
            try {
                addDepend(this);
                computeRefQueue.push(this);
                this.setValue(this.provider());
                this.dispatch();
            } finally {
                computeRefQueue.pop();
            }
        }
        return this.value;
    }

    public clear(): void {
        this.valueStringify = undefined;
    }

}

export class RefCache<Value = any, Scope = any> extends RefValue<Value, Scope> {
    constructor(scope: Scope, provider: Value, protected save: (value: string) => void) {
        super(scope, provider);
    }

    protected setValue(value: Value): boolean {
        let change = super.setValue(value);
        if (change && this.save) {
            this.save(this.valueStringify);
        }
        return change;
    }
}
