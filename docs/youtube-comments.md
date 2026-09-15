# 공개 댓글 갱신

- GitHub 저장소 Settings → Secrets and variables → Actions에 `YOUTUBE_API_KEY`를 등록합니다. Google Cloud에서 YouTube Data API v3가 활성화된 키가 필요합니다. 키를 소스·브라우저·채팅에 넣지 않습니다.
- 기존 시간별 워크플로가 키가 있을 때만 댓글 수집을 실행합니다. GitHub 예약 실행은 지연될 수 있으므로 정확한 시각을 보장하지 않습니다.
- 채널별 `commentThreads.list(allThreadsRelatedToChannelId)`의 모든 페이지를 순회합니다. 영상 유형이나 최근 영상 개수로 제한하지 않습니다. 답글이 inline 응답에 모두 없으면 `comments.list(parentId)`를 끝까지 순회합니다.
- 영상별 표는 실제 댓글이 반환된 영상만 표시합니다. 댓글 없는 영상·댓글 비활성 영상의 수를 추측하지 않습니다. 삭제·비공개·검토 대기 댓글은 포함되지 않습니다.
- 모든 수집 댓글은 유지/강화, 수정/보완, 중립/기타, 복합/검토 필요, 운영자 중 한 곳에 포함됩니다. 분류는 자동 키워드 검토 보조이며 의미 분석·실제 고객 확인·직원 능력 평가는 아닙니다.
- 공동 채널은 한 번만 수집하며 개별 직원에게 귀속하지 않습니다. 원문·작성자를 게시하지 않고 집계·분류 설명·원문 링크만 저장합니다.
- 요청 제한·권한·할당량·응답 오류 또는 답글 건수 부족 시 전체 갱신을 실패 처리하고 이전 스냅샷을 보존합니다. 한 실행에 최대 350회 API 요청을 허용합니다. 실제 프로젝트 할당량과 다른 API 사용량을 확인해야 합니다.
- 키 연결 전에는 기존 수동 검토 표본을 표시합니다. 첫 실데이터 실행 성공과 배포 후에만 전수 공개 페이지 순회 완료 상태가 표시됩니다.

문서: [commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list), [comments.list](https://developers.google.com/youtube/v3/docs/comments/list).
