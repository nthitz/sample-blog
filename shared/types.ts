export interface PostSection {
  heading: string;
  paragraphs: string[];
}
export interface PostSummary {
  slug: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  color: string;
  excerpt: string;
}
export interface Post extends PostSummary {
  sections: PostSection[];
}
