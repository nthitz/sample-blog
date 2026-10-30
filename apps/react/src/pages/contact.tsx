import { PageMeta, Paragraphs } from '../shell.tsx';
import type { contact as pageContent } from '../../../../shared/content.ts';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { getContact } from '../api.ts';
export function loader({ request }: LoaderFunctionArgs) {
  return getContact(request);
}
export function Component() {
  const contact = useLoaderData<typeof pageContent>();
  return (
    <article className="page">
      <PageMeta title="Contact" description={contact.title} />
      <p className="eyebrow">Get in touch</p>
      <h1>{contact.title}</h1>
      <div className="prose">
        <Paragraphs items={contact.paragraphs} />
      </div>
      <div className="contact-box">
        <p className="eyebrow">Drop us a note</p>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
        <p className="meta">Demo address · no inbox connected</p>
      </div>
    </article>
  );
}
