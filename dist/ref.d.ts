import ListenerContainer from './listener';
export interface RefCacheConfig<Value> {
    name: string;
    local?: boolean;
    value: Value;
}
export declare type RefListener<Value> = (value: Value, oldValue: Value) => void;
export interface RefScope {
    listenRefs: Ref[];
    refMap: Map<Ref, Map<Ref, Ref>>;
}
export interface RefStorage {
    getItem(key: string): string;
    setItem(key: string, value: string): any;
}
export default class Refs {
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
    ofCache<Value = any, Scope = any>(config: RefCacheConfig<Value>, scope?: Scope): RefCache<Value, Scope>;
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
export declare abstract class Ref<Value = any, Scope = any> {
    protected readonly scope: Scope;
    protected readonly listeners: ListenerContainer<RefListener<Value>>;
    protected oldValue: Value;
    protected value: Value;
    protected valueStringify: string;
    constructor(scope: Scope);
    abstract get(): Value;
    abstract clear(): void;
    getScope(): Scope;
    listen(listener: RefListener<Value>, scope?: Scope): void;
    interrupt(scope: Scope): void;
    protected setValue(value: Value): boolean;
    protected dispatch(): void;
}
export declare class RefValue<Value = any, Scope = any> extends Ref<Value, Scope> {
    protected provider: Value;
    protected operators?: any[];
    constructor(scope: Scope, provider: Value, /** settable operator */ operators?: any[]);
    get(): Value;
    set(value: Value, operator?: any): void;
    clear(): void;
}
export declare class RefComputed<Value = any, Scope = any> extends Ref<Value, Scope> {
    protected provider: (() => Value);
    constructor(scope: Scope, provider: (() => Value));
    get(): Value;
    clear(): void;
}
export declare class RefCache<Value = any, Scope = any> extends RefValue<Value, Scope> {
    protected save: (value: string) => void;
    constructor(scope: Scope, provider: Value, save: (value: string) => void);
    protected setValue(value: Value): boolean;
}
