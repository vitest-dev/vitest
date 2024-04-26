export function Controller(prefix: string): ClassDecorator {
  return () => {}
}

export function Injectable(): ClassDecorator {
  return  () => {}
}

export const Post: (() => MethodDecorator) = () => {
  return () => {}
}

export const Get: (() => MethodDecorator) = () => {
  return () => {}
}

export const Body: () => ParameterDecorator = () => {
  return () => {}
}
