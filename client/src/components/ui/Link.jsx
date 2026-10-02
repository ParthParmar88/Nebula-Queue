/** In-app link for the hash router: <Link to="/jobs">. Renders a real anchor (middle-click, open in new tab work). */
export default function Link({ to, children, ...props }) {
  return (
    <a href={`#${to}`} {...props}>
      {children}
    </a>
  )
}
