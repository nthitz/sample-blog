export const site = {
  name: 'Fieldnotes',
  tagline: 'Small observations. Better everyday things.',
  description:
    'A journal about thoughtful design, useful technology, and making room for a slower day.',
};

export const about = {
  title: 'A place for the things worth noticing.',
  paragraphs: [
    'Fieldnotes is a small, independent journal about design, technology, and everyday life. We are interested in the details that make things feel considered: a useful tool, a welcoming room, a website that simply works.',
    'Our approach is straightforward. Get curious, try things, and write down what we learn. Some stories begin at a desk; others begin on a walk around the block.',
    'There is no publishing treadmill here. Just a handful of thoughtful articles, written to be read at your own pace. Thanks for spending a little of your day with us.',
  ],
};
export const contact = {
  title: 'Good conversations start somewhere.',
  paragraphs: [
    'Have a story idea, a question about an article, or something interesting you think we should see? We would love to hear from you.',
    'This is a demonstration journal. The email address below is a placeholder, and no messages are collected by this site.',
  ],
  email: 'hello@fieldnotes.example',
};
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
