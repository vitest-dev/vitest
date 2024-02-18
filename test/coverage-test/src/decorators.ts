// eslint-disable-next-line ts/ban-ts-comment -- so that typecheck doesn't include it
// @ts-nocheck
export class DecoratorsTester {
  method(@SomeDecorator parameter: Something) {
    if (parameter) {
      // Covered line
      noop(parameter)
    }

    if (parameter === 'uncovered') {
      // Uncovered line
      noop(parameter)
    }
  }
}

function SomeDecorator(
  _target: Object,
  _propertyKey: string | symbol,
  _parameterIndex: number,
) {}

type Something = unknown

function noop(..._args: unknown[]) {

}
