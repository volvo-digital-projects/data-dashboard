import LoginHome from "./LoginHome";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <LoginHome
      viewer={{
        displayName: user?.displayName ?? "관리자 미리보기",
        email: user?.email ?? null,
      }}
    />
  );
}
