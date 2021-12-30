const Fetcher = ({
  children,
  loader = <div>Loading...</div>,
}: {
  children: Function | null;
  loader?: React.ReactNode;
}) => {
  const loading = false;
  const data = [];

  if (loading) return loader;
  return (children as Function)(data);
};

export default Fetcher;
