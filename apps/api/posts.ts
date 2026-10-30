import { longPost } from './long-post.ts';
import type { Post } from '../../shared/types.ts';
export const posts: Post[] = [
  {
    slug: 'a-little-less-but-better',
    title: 'A little less, but better',
    category: 'Design',
    date: '2026-10-15',
    readTime: '4 min read',
    color: 'clay',
    excerpt:
      'On the quiet satisfaction of choosing fewer things, and giving the ones that remain a little more care.',
    sections: [
      {
        heading: 'Start with what is already there',
        paragraphs: [
          'Last weekend I cleared everything off my desk. Not to buy a new organizer or take a photograph of an empty surface, but to notice what I actually reached for when I started working again.',
          'A notebook came back first. Then a lamp, a pencil, and the mug with the chipped handle. Most of the other things stayed in the box. The desk felt less like a display and more like a place to do something.',
        ],
      },
      {
        heading: 'Make the useful things easy',
        paragraphs: [
          'Good design often starts with a small subtraction. A clearer label. One less decision. Enough space around a paragraph that you can follow the thought without losing your place.',
          'This is not a rule about owning fewer objects. It is a habit of asking whether something helps. Sometimes the answer is a generous shelf of books. Sometimes it is a single empty drawer.',
        ],
      },
      {
        heading: 'Leave a little room',
        paragraphs: [
          'The best part of a simpler setup is the room it leaves for change. There is space for a new project, an unfinished sketch, or a conversation that lasts longer than expected.',
          'Try moving one thing out of the way this week. Keep it nearby. See whether you miss it. A useful change does not need to announce itself.',
        ],
      },
    ],
  },
  {
    slug: 'taking-the-long-way-home',
    title: 'Taking the long way home',
    category: 'Everyday',
    date: '2026-10-08',
    readTime: '3 min read',
    color: 'sage',
    excerpt:
      'A familiar neighborhood looks different when you stop treating the walk as the space between two destinations.',
    sections: [
      {
        heading: 'A different turn',
        paragraphs: [
          'There are two ways home from the bakery. One follows the main road and takes seven minutes. The other winds past a community garden, a crooked fence, and a house where someone always leaves the porch light on.',
          'I took the longer route on a Tuesday because the weather was good. By Friday it had become the part of the day I looked forward to.',
        ],
      },
      {
        heading: 'Attention is a practice',
        paragraphs: [
          'Walking without headphones feels strange at first. You hear delivery carts, the scrape of a gate, and bits of conversations that disappear before they become stories.',
          'You also begin to notice changes. The first leaves on the pavement. A new sign in an old window. A neighbor repairing the same bicycle for the third afternoon in a row.',
        ],
      },
      {
        heading: 'Time well spent',
        paragraphs: [
          'The longer route adds twelve minutes. It has not made me more productive or helped me finish a reading list. It has simply made the neighborhood feel more like somewhere I live.',
          'That seems like a good enough reason to keep taking it.',
        ],
      },
    ],
  },
  {
    slug: 'building-for-the-web-we-use',
    title: 'Building for the web we actually use',
    category: 'Technology',
    date: '2026-10-01',
    readTime: '5 min read',
    color: 'blue',
    excerpt:
      'Fast pages, familiar links, and the small details that make a website feel comfortable from the very first visit.',
    sections: [
      {
        heading: 'The ordinary moments matter',
        paragraphs: [
          'Most visits to a website are wonderfully ordinary. Someone opens a link from a friend, skims a few paragraphs on a phone, and comes back later on a laptop.',
          'Those moments deserve as much attention as the carefully rehearsed demo. A page should still be useful on an old device, during a train ride, or with the text enlarged.',
        ],
      },
      {
        heading: 'Give the browser a hand',
        paragraphs: [
          'Links should behave like links. Headings should describe the content below them. The back button should return people to a place they recognize.',
          'These are modest expectations, but meeting them consistently gives a site a sense of calm. Visitors can spend their attention on the content instead of learning how the interface works.',
        ],
      },
      {
        heading: 'Keep the foundation clear',
        paragraphs: [
          'A small site is a good place to practice these habits. Start with readable content, a sensible structure, and a layout that fits the screen. Add complexity when it earns its place.',
          'The result may not look revolutionary. It will be something people can use, and that is a meaningful achievement.',
        ],
      },
    ],
  },
  longPost,
];
