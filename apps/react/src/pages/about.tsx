import { PageMeta, Paragraphs } from '../shell.tsx';
import { Link } from 'react-router';
import type { about as pageContent } from '../../../../shared/content.ts';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { getAbout } from '../api.ts';
export function loader({ request }: LoaderFunctionArgs) {
  return getAbout(request);
}
export function Component() {
  const about = useLoaderData<typeof pageContent>();
  return (
    <article className="page">
      <PageMeta title="About" description={about.title} />
      <p className="eyebrow">About Fieldnotes</p>
      <h1>{about.title}</h1>
      <div className="prose">
        <Paragraphs items={about.paragraphs} />
      </div>
      <p className="note">
        <Link to="/contact/">Say hello →</Link>
      </p>
    </article>
  );
}
