import type { LoaderFunctionArgs } from 'react-router';
import type { Post, PostSummary } from '../../../../shared/types.ts';
import { Link, useLoaderData } from 'react-router';
import { site, formatDate } from '../../../../shared/content.ts';
import { Art, PageMeta } from '../shell.tsx';
import { getPosts } from '../api.ts';
export function loader({ request }: LoaderFunctionArgs) {
  return getPosts(request);
}
export function Component() {
  const posts = useLoaderData<PostSummary[]>();
  return (
    <>
      <PageMeta title="Journal" description={site.description} />
      <section className="intro">
        <p className="eyebrow">An independent journal</p>
        <h1>{site.tagline}</h1>
        <p className="lede">{site.description}</p>
      </section>
      <section aria-labelledby="latest">
        <div className="section-heading">
          <h2 id="latest">The latest notes</h2>
          <span>Take a moment. Stay a while.</span>
        </div>
        <div className="posts">
          {posts.map((post) => (
            <article className="card" key={post.slug}>
              <Art post={post} />
              <span className="eyebrow">{post.category}</span>
              <h2>
                <Link to={`/posts/${post.slug}/`}>{post.title}</Link>
              </h2>
              <div className="meta">
                <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readTime}
              </div>
              <p>{post.excerpt}</p>
              <Link
                className="read-link"
                to={`/posts/${post.slug}/`}
                aria-label={`Read ${post.title}`}
              >
                Read the story →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <p className="note">A few considered words, every now and then. No rush to keep up.</p>
    </>
  );
}
