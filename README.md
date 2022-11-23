# Ref

Create a reference object that can be monitored.

## Usage

### Refs

* Create

    * typescript

        ```typescript
        import Refs from "ts-refs";

        const refs = new Refs();

        // Set cache storage.
        refs.setLocalStorage(localStorage);
        refs.setSessionStorage(sessionStorage);
        ```
    * javascript

        [ref.min.js](lib/ref.min.js)

        ```html
        <script type="application/javascript" src="ref.min.js"></script>
        <script type="application/javascript">

            var refs = new RefModule.default();

            // Set cache storage.
            refs.setLocalStorage(localStorage);
            refs.setSessionStorage(sessionStorage);
        </script>
        ```

### Value Ref

* Create

    ```typescript
    const valueRef = refs.of(0); // RefValue<number>
    ```

* get

    ```typescript
    valueRef.get(); // 0
    ```
    
* set

    ```typescript
    valueRef.set(1);
    ```

* listen

    ```typescript
    valueRef.listen((value)=>{
        // TODO
    },this);
    ```

* interrupt
    Interrupt `Ref` listen by target.
    ```typescript
    valueRef.interrupt(this);
    ```

* clear

    Reset to default value.
    ```typescript
    valueRef.clear();
    ```

### Computed Ref

Save the computed results. Recompute when `Ref` changes.

* Create

    ```typescript
    const valueRef = refs.of(0); 
    const computedRef = refs.ofComputed(()=>{
        return valueRef.get()+1;
    }); // RefComputed<number>
    ```

* get
    
    Changed by dependent on other `Ref`.

    ```typescript
    computedRef.get(); // 0+1
    ```

* listen

    Change by o

    ```typescript
    computedRef.listen((value)=>{
        // TODO
    },this);
    ```

* interrupt
    Interrupt ref listen by target.
    ```typescript
    computedRef.interrupt(this);
    ```

* clear

    Clear computed results.
    ```typescript
    computedRef.clear();
    ```

### Cache Ref

Cache the last value in storage.

* Create

    ```typescript
    const valueRef = refs.ofCache({
        name:'string'
        , local:false // switch storage type
        , value: 0
    }); // RefCache<number>
    ```

* get

    ```typescript
    valueRef.get(); // 0
    ```
    
* set

    ```typescript
    valueRef.set(1);
    ```

* listen

    ```typescript
    valueRef.listen((value)=>{
        // TODO
    },this);
    ```

* interrupt
    Interrupt `Ref` listen by target.
    ```typescript
    valueRef.interrupt(this);
    ```

* clear

    Reset to default value.
    ```typescript
    valueRef.clear();
    ```

## Advanced


### Refs

* off

    Remove all dependencies and listener by scope.

    ```typescript
    refs.off(this);
    ```

* runInScope

    ```typescript
    let a = {};
    refs.runInScope(()=>{
        // The default scope for all operations is `a`.
        ref1.listen(()=>{});
        ref2.listen(()=>{});
        ref3.listen(()=>{});
    },a);
    ```
* tx

    Post notifications after processing all `Ref` updates.

    ```typescript
    refs.tx(()=>{
        ref1.set(...)
        ref2.set(...)
        ref3.set(...)
    });
    ```