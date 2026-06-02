// happy-dom's dts will break `skipLibCheck: false`.
// for now, override happy-dom type for the sake of testing other packages.
export const Window = {} as any
