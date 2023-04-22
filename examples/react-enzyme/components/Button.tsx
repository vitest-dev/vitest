function Button({ onClick, text }: any) {
  return <button className={'some-className'} onClick={onClick}>
    {text}
  </button>
}

export default Button
