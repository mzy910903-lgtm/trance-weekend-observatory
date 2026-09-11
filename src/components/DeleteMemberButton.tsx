"use client";

export function DeleteMemberButton() {
  return (
    <form
      action="/api/member/delete"
      method="post"
      className="mt-4"
      onSubmit={(event) => {
        if (!window.confirm("确认清除微信身份、收藏和关注数据？此操作无法恢复。")) {
          event.preventDefault();
        }
      }}
    >
      <button className="rounded-full border border-red-300/30 px-4 py-2 text-sm text-red-100 hover:bg-red-300 hover:text-black">
        清除我的个人数据
      </button>
    </form>
  );
}
