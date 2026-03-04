import crypto from 'node:crypto'

export const hash: typeof crypto.hash = crypto.hash ?? ((
  algorithm: string,
  data: crypto.BinaryLike,
  outputEncoding: crypto.BinaryToTextEncoding,
) => crypto.createHash(algorithm).update(data).digest(outputEncoding))
