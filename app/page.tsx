import Dashboard from "./Dashboard";
import { getChatGPTUser } from "./chatgpt-auth";
import { isEditorEmail } from "./permissions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const isLocalPreview = !user;

  return (
    <Dashboard
      viewer={{
        displayName: user?.displayName ?? "관리자 미리보기",
        email: user?.email ?? null,
        isEditor: user ? isEditorEmail(user.email) : isLocalPreview,
      }}
    />
  );
}
