/**
 * This generates es5 files for single entry-point TS files. It's used for the webworker files: core, core utils, plugins.
 *
 * TODO at the moment we're actually loading the utils code twice. There's no reason for this - the core script COULD load
 * this generated file & use the methods from the window object; as long as the typings were provided that'd cut down on
 * build size. But honestly it's <20KB and there are bigger fish to fry.
 */
import path from 'path';
import fs from 'fs';
import md5File from 'md5-file';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import removeExports from 'rollup-plugin-strip-exports';
import { terser } from 'rollup-plugin-terser';
import removeImports from './build/rollup-plugin-remove-imports';
const helpers = require('./build/helpers');

/**
 * example usage:
 *    npm rollup -c --config-src=src/utils/coreUtils.ts --config-target=dist/workers/coreUtils.js`
 *    npx rollup -c --config-src=src/utils/workerUtils.ts --config-target=dist/debug.js
 *    npx rollup -c --config-src=src/plugins/dataTypes/Date/Date.generator.ts --config-target=dist/debug.js
 *    npx rollup -c --config-src=src/plugins/countries/Australia/bundle.ts --config-target=dist/australia.js
 */
export default (cmdLineArgs) => {
	const { 'config-src': src, 'config-target': target } = cmdLineArgs;

	if (!src || !target) {
		console.error("\n*** Missing command line args. See file for usage. ***\n");
		return;
	}

	const terserCompressProps = {};

	// before we do anything, we create a new file containing the hash of the file. This is used for performance reasons:
	// building every last web worker bundle is slllllow! This file is used by the grunt tasks in dev to only ever
	// regenerate the bundles if the content has changed
	const file = helpers.getFileHash(src);
	const fileHash = md5File.sync(src);
	const folder = path.dirname(target);
	const fileWithPath = `${folder}/${file}`;
	if (fs.existsSync(fileWithPath)) {
		fs.unlinkSync(fileWithPath);
	}
	fs.writeFileSync(fileWithPath, fileHash);

	// the whole point of the workerUtils file is to expose all utility methods in a single `utils` object
	// for use by plugin web workers. This is available on the global scope within a web worker
	if (src === 'src/utils/workerUtils.ts') {
		terserCompressProps.top_retain = ['utils', 'onmessage'];
	} else if (/src\/plugins\/countries/.test(src)) {
		const folder = path.dirname(src).split(path.sep);
		terserCompressProps.top_retain = [folder[folder.length-1]];
	} else {
		terserCompressProps.unused = true;
		terserCompressProps.top_retain = ['utils', 'onmessage', 'Australia'];
	}

	return {
		input: src,
		output: {
			file: target,
			format: 'es',
		},
		treeshake: false,
		plugins: [
			removeImports(),
			nodeResolve(),
			typescript({
				tsconfigOverride: {
					compilerOptions: {
						target: 'es5'
					}
				}
			}),
			terser({
				mangle: false,
				compress: {
					...terserCompressProps
				}
			}),
			removeExports()
		]
	}
};

