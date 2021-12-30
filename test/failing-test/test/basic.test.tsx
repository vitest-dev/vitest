import '@testing-library/jest-dom';
import Fetcher from './Fetcher';
import { render } from './testUtils';

test('simple renderz', () => {
  render(<Fetcher>{() => <div>Hello</div>}</Fetcher>);
  // expect(screen.getByText('Hello')).toBeInTheDocument();
});
