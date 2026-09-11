import "server-only";

import { getCurrentMember } from "@/lib/member-auth";
import { prisma } from "@/lib/prisma";

export async function getViewerState(articleIds: string[] = [], tagIds: string[] = []) {
  const user = await getCurrentMember();
  if (!user) {
    return {
      user: null,
      bookmarkedArticleIds: new Set<string>(),
      followedTagIds: new Set<string>(),
    };
  }

  const [bookmarks, follows] = await Promise.all([
    articleIds.length
      ? prisma.bookmark.findMany({
          where: { userId: user.id, articleId: { in: articleIds } },
          select: { articleId: true },
        })
      : [],
    tagIds.length
      ? prisma.tagFollow.findMany({
          where: { userId: user.id, tagId: { in: tagIds } },
          select: { tagId: true },
        })
      : [],
  ]);

  return {
    user,
    bookmarkedArticleIds: new Set(bookmarks.map((item) => item.articleId)),
    followedTagIds: new Set(follows.map((item) => item.tagId)),
  };
}
