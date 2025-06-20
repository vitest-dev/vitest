/*
 * Vite does not transform `*.cts` files.
 * If this file is picked by Istanbul provider, it will make Babel crash on TS syntax.
 */
interface Props {
  name: string;
}
