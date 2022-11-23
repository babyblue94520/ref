import typescript from 'rollup-plugin-typescript';
import buble from 'rollup-plugin-buble';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  input: 'src/ref.ts',
  plugins: [
    typescript(),
    buble({
      transforms: { dangerousForOf: true }
    }),
    nodeResolve({
      jsnext: true,
      main: true
    })
  ],
  output: {
    file: 'lib/ref.js',
    format: 'iife',
    name: 'RefModule'
  }
};

