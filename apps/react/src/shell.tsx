import type { PostSummary } from '../../../shared/types.ts';
import { useEffect, useRef } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router';

export function Layout() {
  const navigation = useNavigation();
  const location = useLocation();
  const main = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    main.current?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <Link className="brand" to="/">
          Fieldnotes<span>.</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Journal
          </NavLink>
          <NavLink to="/about/">About</NavLink>
          <NavLink to="/contact/">Contact</NavLink>
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1} aria-busy={navigation.state !== 'idle'}>
        {navigation.state !== 'idle' && (
          <div className="status" role="status">
            Loading the next page…
          </div>
        )}
        <Outlet />
      </main>
      <footer>
        <span>© 2026 Fieldnotes. Made with a little care.</span>
        <span>A journal for the everyday curious.</span>
      </footer>
      <ScrollRestoration />
    </>
  );
}

export function PageMeta({ title, description }: { title: string; description: string }) {
  return (
    <>
      <title>{title} · Fieldnotes</title>
      <meta name="description" content={description} />
    </>
  );
}
export function Art({ post }: { post: PostSummary }) {
  return <div className={`art ${post.color}`} aria-hidden="true" />;
}
export function Paragraphs({ items }: { items: string[] }) {
  return items.map((p) => <p key={p}>{p}</p>);
}
export function MissingPage() {
  return (
    <section className="error">
      <PageMeta title="Page not found" description="This page could not be found." />
      <p className="eyebrow">404 · A wrong turn</p>
      <h1>This page wandered off.</h1>
      <p className="lede">
        The story you are looking for is not here. There are a few good ones back at the journal.
      </p>
      <Link to="/">Back to the journal →</Link>
    </section>
  );
}
export function RouteError() {
  const error = useRouteError();
  return (
    <main id="main">
      {isRouteErrorResponse(error) && error.status === 404 ? (
        <MissingPage />
      ) : (
        <section className="error">
          <h1>Something went wrong.</h1>
          <p>Please reload the page and try again.</p>
          <a href="/">Back to the journal →</a>
        </section>
      )}
    </main>
  );
}
