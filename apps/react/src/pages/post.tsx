import type { LoaderFunctionArgs } from 'react-router';
import type { Post, PostSummary } from '../../../../shared/types.ts';
import { Link, useLoaderData } from 'react-router';
import { formatDate } from '../../../../shared/content.ts';
import { Art, PageMeta, Paragraphs } from '../shell.tsx';
import { getPost } from '../api.ts';
export function loader({ params, request }: LoaderFunctionArgs) {
  return getPost(params.slug ?? '', request);
}
export function Component() {
  const post = useLoaderData<Post>();
  return (
    <article className="article">
      <PageMeta title={post.title} description={post.excerpt} />
      <Link className="back" to="/">
        ← Back to the journal
      </Link>
      <p className="eyebrow">{post.category}</p>
      <h1>{post.title}</h1>
      <p className="lede">{post.excerpt}</p>
      <div className="meta">
        <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readTime}
      </div>
      <Art post={post} />
      <div className="prose">
        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <Paragraphs items={section.paragraphs} />
          </section>
        ))}
      </div>
      <p className="note">
        <Link to="/">Explore more stories →</Link>
      </p>
    </article>
  );
}
