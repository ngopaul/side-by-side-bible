import { notFound } from "next/navigation";

import { Reader } from "@/components/reader";
import { getBook, isBookId } from "@/lib/bible/canon";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ book: string; chapter: string }>;
}) {
  const values = await params;
  const book = values.book.toUpperCase();
  const chapter = /^\d+$/u.test(values.chapter) ? Number(values.chapter) : 0;

  if (!isBookId(book) || chapter < 1 || chapter > getBook(book).chapters) {
    notFound();
  }

  return <Reader book={book} chapter={chapter} />;
}
