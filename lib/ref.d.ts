declare class ListenerContainer<Listener extends Function = Function> {
    private readonly listenerMap;
    private listeners;
    addListener(listener: Listener, target?: Object): Listener;
    addOnceListener(listener: Listener, target?: Object): Listener;
    removeListener(listener: Listener): void;
    removeAllListener(target: Object): void;
    dispatch(...args: any[]): Promise<any[]>;
    dispatchIgnoreTarget(target: any, ...args: any[]): Promise<any[]>;
    count(): number;
    clear(): void;
    private mark;
    private clearMark;
}

interface RefCacheConfig<Value> {
    /** Cache name*/
    name: string;
    /** Cache value in localStorage or sessionStorage. default cache in sessionStorage.*/
    local?: boolean;
    value: Value;
}
declare type RefListener<Value> = (value: Value, oldValue: Value) => void;
interface RefScope {
    listenRefs: Ref[];
    refMap: Map<RefComputed, Map<RefComputed, RefComputed>>;
}
interface RefStorage {
    getItem(key: string): string;
    setItem(key: string, value: string): any;
    removeItem(key: string): void;
}
declare class Refs {
    private localStorage;
    private sessionStorage;
    /**
     *
     * @param value
     * @param scope
     * @param operators Settable operator.
     * @returns RefValue
     */
    of<Value = any, Scope = any>(value: Value, scope?: Scope, operators?: any[]): RefValue<Value, Scope>;
    ofComputed<Value = any, Scope = any>(provider: (() => Value), scope?: Scope): RefComputed<Value, Scope>;
    /**
     * Create cacheable Ref.
     */
    ofCache<Value = any, Scope = any>(config: RefCacheConfig<Value>, scope?: Scope, operators?: any[]): RefValue<Value, Scope>;
    /**
     * Operate any ref in scope.
     */
    runInScope(runnable: Function, scope: any): void;
    /**
     * Remove all dependencies and listener by scope.
     */
    off(scope: any): void;
    setLocalStorage(storage: RefStorage): void;
    setSessionStorage(storage: RefStorage): void;
    /**
     * Post notifications after processing all value updates.
     */
    tx(runnable: Function): void;
}
declare abstract class Ref<Value = any, Scope = any> {
    protected readonly scope: Scope;
    protected readonly listeners: ListenerContainer<RefListener<Value>>;
    protected oldValue: Value;
    protected value: Value;
    protected valueStringify: string;
    constructor(scope: Scope);
    abstract get(): Value;
    stringify(): string;
    getScope(): Scope;
    listen(listener: RefListener<Value>, scope?: any): void;
    interrupt(scope: any): void;
    protected setValue(value: Value): void;
    protected doSetValue(value: Value): boolean;
}
declare class RefValue<Value = any, Scope = any> extends Ref<Value, Scope> {
    protected provider: Value;
    protected operators?: any[];
    constructor(scope: Scope, provider: Value, /** settable operator */ operators?: any[]);
    get(): Value;
    clear(): void;
    set(value: Value, operator?: any): void;
    /**
     * Operators can only be set once.
     */
    setOperators(...operators: any[]): void;
}
declare class RefComputed<Value = any, Scope = any> extends Ref<Value, Scope> {
    protected provider: (() => Value);
    private dirty;
    constructor(scope: Scope, provider: (() => Value));
    protected setValue(value: Value): void;
    get(force?: boolean): Value;
}

export { Ref, type RefCacheConfig, RefComputed, type RefListener, type RefScope, type RefStorage, RefValue, Refs as default };
