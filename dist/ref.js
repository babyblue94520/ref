import ListenerContainer from './listener';
const refDependMap = new Map();
const scopeMap = new Map();
const computeRefQueue = [];
const scopeQueue = [];
const txRefs = [];
let currentScope = {};
let cleaning = false;
let transaction = false;
function listen(ref, scope) {
    scope = getScope(scope);
    getRefScope(scope).listenRefs.push(ref);
    return scope;
}
function clearDepend(ref) {
    if (cleaning)
        return;
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
function clearDepends() {
    if (cleaning)
        return;
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
function scanRef(ref, collection = new Map()) {
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
function addDepend(ref) {
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
function getScope(scope) {
    return scope || currentScope;
}
function getRefScope(scope) {
    return computeIfAbsent(scopeMap, scope, (k) => {
        return {
            listenRefs: [],
            refMap: new Map()
        };
    });
}
function computeIfAbsent(map, key, callable) {
    let value = map.get(key);
    if (value == undefined) {
        map.set(key, (value = callable(key)));
    }
    return value;
}
export default class Refs {
    constructor() {
        this.localStorage = { getItem(key) { return null; }, setItem(key, value) { } };
        this.sessionStorage = { getItem(key) { return null; }, setItem(key, value) { } };
    }
    /**
     *
     * @param value
     * @param scope
     * @param operators Settable operator.
     * @returns RefValue
     */
    of(value, scope, operators) {
        return new RefValue(getScope(scope), value, operators);
    }
    ofComputed(provider, scope) {
        return new RefComputed(getScope(scope), provider);
    }
    /**
     * Create cacheable Ref.
     */
    ofCache(config, scope) {
        let storage = config.local ? this.localStorage : this.sessionStorage;
        let value = storage.getItem(config.name);
        if (value) {
            try {
                value = JSON.parse(value);
            }
            catch (e) {
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
    runInScope(runnable, scope) {
        try {
            scopeQueue.push(currentScope);
            currentScope = scope;
            runnable();
        }
        finally {
            currentScope = scopeQueue.pop();
        }
    }
    /**
     * Remove all dependencies and listener by scope.
     */
    off(scope) {
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
    setLocalStorage(storage) {
        this.localStorage = storage;
    }
    setSessionStorage(storage) {
        this.sessionStorage = storage;
    }
    /**
     * Post notifications after processing all value updates.
     */
    tx(runnable) {
        transaction = true;
        try {
            runnable();
        }
        finally {
            transaction = false;
            clearDepends();
        }
    }
}
export class Ref {
    constructor(scope) {
        this.scope = scope;
        this.listeners = new ListenerContainer();
    }
    getScope() {
        return this.scope;
    }
    listen(listener, scope) {
        scope = listen(this, scope);
        listener(this.get(), this.oldValue);
        this.listeners.addListener(listener, scope);
    }
    interrupt(scope) {
        this.listeners.removeAllListener(scope);
    }
    setValue(value) {
        let stringify = JSON.stringify(value);
        if (this.valueStringify === stringify)
            return false;
        this.oldValue = this.value;
        this.value = value;
        this.valueStringify = stringify;
        return true;
    }
    dispatch() {
        clearDepend(this);
        this.listeners.dispatch(this.value);
    }
}
export class RefValue extends Ref {
    constructor(scope, provider, /** settable operator */ operators) {
        super(scope);
        this.provider = provider;
        this.operators = operators;
        this.setValue(provider);
    }
    get() {
        addDepend(this);
        return this.value;
    }
    set(value, operator) {
        var _a;
        if ((((_a = this.operators) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0 && this.operators.indexOf(operator) == -1) {
            console.error('The operator does\'t settable!', operator);
            throw new Error('The operator does\'t settable!');
        }
        if (this.setValue(value)) {
            this.dispatch();
        }
    }
    clear() {
        this.set(this.provider);
    }
}
export class RefComputed extends Ref {
    constructor(scope, provider) {
        super(scope);
        this.provider = provider;
    }
    get() {
        if (this.valueStringify == undefined) {
            try {
                addDepend(this);
                computeRefQueue.push(this);
                this.setValue(this.provider());
                this.dispatch();
            }
            finally {
                computeRefQueue.pop();
            }
        }
        return this.value;
    }
    clear() {
        this.valueStringify = undefined;
    }
}
export class RefCache extends RefValue {
    constructor(scope, provider, save) {
        super(scope, provider);
        this.save = save;
    }
    setValue(value) {
        let change = super.setValue(value);
        if (change && this.save) {
            this.save(this.valueStringify);
        }
        return change;
    }
}
