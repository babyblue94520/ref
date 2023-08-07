import ListenerContainer from './listener';

const refDependMap = new Map<Ref, Map<RefComputed, RefComputed>>();

const scopeMap = new Map<any, RefScope>();

const computeRefQueue: RefComputed[] = [];

const scopeQueue: any[] = [];

const txRefs = [];

const __clear = '__c';
const __notify = '__n';

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
    doClearDepend(scanRef(ref));
}

function clearDepends(): void {
    if (cleaning) return;
    let refMap = new Map();
    txRefs.forEach(ref => scanRef(ref, refMap));
    doClearDepend(refMap);
    txRefs.length = 0;
}


function doClearDepend(refMap: Map<RefComputed, RefComputed>): void {
    if (refMap.size == 0) return;
    cleaning = true;
    refMap.forEach(r => r[__clear]());
    refMap.forEach(r => r[__notify]());
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


export interface RefCacheConfig<Value> {
    /** Cache name*/
    name: string;
    /** Cache value in localStorage or sessionStorage. default cache in sessionStorage.*/
    local?: boolean;
    value: Value;
}

export type RefListener<Value> = (value: Value, oldValue: Value) => void;

export interface RefScope {
    listenRefs: Ref[];
    refMap: Map<RefComputed, Map<RefComputed, RefComputed>>;
}

export interface RefStorage {
    getItem(key: string): string;
    setItem(key: string, value: string);
    removeItem(key: string): void;
}

const defaultStorage = { getItem(key) { return null; }, setItem(key, value) { }, removeItem(key) { } };

export default class Refs {

    private localStorage: RefStorage = defaultStorage;

    private sessionStorage: RefStorage = defaultStorage;

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
        if (cache && cache != 'undefined') {
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
            let value = ref.stringify();
            if (value === undefined) {
                storage.removeItem(config.name);
            } else {
                storage.setItem(config.name, value);
            }
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

    public stringify(): string {
        if (this.valueStringify == undefined) {

        }
        return this.valueStringify;
    }

    public getScope(): Scope {
        return this.scope;
    }

    public listen(listener: RefListener<Value>, scope?: any) {
        scope = listen(this, scope);
        listener(this.get(), this.oldValue);
        this.listeners.addListener(listener, scope);
    }

    public interrupt(scope: any) {
        this.listeners.removeAllListener(scope);
    }

    protected setValue(value: Value) {
        if (this.doSetValue(value)) {
            clearDepend(this);
            this.listeners.dispatch(this.value, this.oldValue);
        }
    }

    protected doSetValue(value: Value): boolean {
        let stringify = value === undefined ? undefined : JSON.stringify(value);
        if (this.valueStringify === stringify) return false;
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
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
            let message = 'The operator does\'t settable!';
            console.error(message, operator);
            throw new Error(message);
        }
        this.setValue(value);
    }

    /**
     * Operators can only be set once.
     */
    public setOperators(...operators: any[]) {
        if ((this.operators?.length || 0) > 0) {
            let message = 'Cannot set operators again!';
            console.error(message);
            throw new Error(message);
        }
        this.operators = operators;
    }
}

export class RefComputed<Value = any, Scope = any> extends Ref<Value, Scope>  {
    private dirty = false;

    constructor(
        scope: Scope
        , protected provider: (() => Value)
    ) {
        super(scope);
        this[__clear] = () => {
            this.valueStringify = undefined;
            this.dirty = false;
        };
        this[__notify] = () => {
            if (this.listeners.count() == 0) return;
            this.get(true);
        };
    }

    protected setValue(value: Value) {
        if (this.doSetValue(value)) {
            if (this.dirty) {
                clearDepend(this);
            }
            this.listeners.dispatch(this.value, this.oldValue);
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