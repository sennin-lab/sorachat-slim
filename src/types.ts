export type CoverTheme = "green" | "sky" | "sunset" | "lavender" | "sand" | "graphite";

export type Me = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  contact: string;
  profileUrl: string;
  hasAvatar: boolean;
  // 画像の版（変わったら値も変わる）。保存済みの画像を使うかの判断に使う
  avatarVersion?: string | null;
  notifyDm: boolean;
  // 通知に本文（メッセージの一部）を含めるか（既定はオフ）
  notifyPreview: boolean;
  sennin: boolean;
  coverTheme: CoverTheme;
  // senninai（AIチャット）を使うか。既定はオフ
  aiEnabled: boolean;
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  name: string;
  otherId: string | null;
  otherUsername: string | null;
  hasAvatar: boolean;
  // グループのアイコンの版（変わったら値も変わる）。保存済みのアイコンを使うかの判断に使う
  avatarVersion?: string | null;
  lastMessageAt: string;
  lastPreview: string | null;
  lastFromMe: boolean;
  unread: number;
  myRole: "owner" | "member";
  memberCount: number;
  // このトークの通知をオフにしているか（自分だけ）
  muted: boolean;
};

export type Reaction = { emoji: string; count: number; mine: boolean };

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  // system はグループのお知らせ（参加・退出・削除・名前の変更）
  kind: "text" | "contact" | "system" | "poll" | "game" | "call" | "stamp";
  body: string | null;
  contact?: { id: string; username: string; displayName: string; hasAvatar: boolean } | null;
  // 投票（kind が poll のとき）。body は質問文
  poll?: PollView | null;
  // ミニゲーム（kind が game のとき）。中身は見る人ごとに違う
  game?: GameView | null;
  // 通話カード（kind が call のとき）。active は今も通話中かどうか
  call?: { callId: string; active: boolean } | null;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  forwarded: boolean;
  // 返信先のメッセージID（返信でないときは null）
  replyToId?: string | null;
  reactions: Reaction[];
  clientId?: string | null;
  // 送信中・送信失敗（ローカルだけの一時表示。保存しない）
  status?: "sending" | "failed";
};

// 投票の中身と集計（counts は選択肢ごとの票数、mine は自分が選んだ番号）
// 匿名でないときは voterDetails に選択肢ごとの投票者が入る（匿名のときは null）
export type PollPerson = { id: string; name: string; hasAvatar: boolean };
export type PollView = {
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
  closedAt: string | null;
  creatorId: string;
  counts: number[];
  mine: number[];
  voters: number;
  voterDetails: PollPerson[][] | null;
};

export type GameKind = "tictactoe" | "quiz" | "janken" | "guess" | "tap" | "reflex";
export type GameHand = "rock" | "scissors" | "paper";

// ミニゲームの画面用の形（サーバーの gameLogic.ts の GameView と同じ）
export type GameView = {
  kind: GameKind;
  status: "waiting" | "playing" | "finished";
  cancelled: boolean;
  creatorId: string;
  me: string;
  players: string[];
  min: number;
  max: number;
  tictactoe: null | {
    board: string[];
    turn: "X" | "O";
    symbols: { X: string; O: string };
    winner: "X" | "O" | "draw" | null;
    line: number[] | null;
  };
  quiz: null | {
    round: number;
    total: number;
    phase: "question" | "revealed" | "done";
    question: string | null;
    options: string[];
    buzzed: string | null;
    tried: string[];
    scores: Record<string, number>;
    result: { answer: number; choice: number | null; by: string | null; correct: boolean } | null;
    // 次の締め切りまでの残り（ミリ秒）。締め切りがないときは null
    deadlineIn: number | null;
  };
  janken: null | {
    round: number;
    phase: "hand" | "revealed" | "done";
    alive: string[];
    submitted: string[];
    myHand: GameHand | null;
    last: { hands: Record<string, GameHand>; outcome: "draw" | "win"; winningHand: GameHand | null; eliminated: string[] } | null;
    champion: string | null;
    deadlineIn: number | null;
  };
  guess: null | {
    min: number;
    max: number;
    guesses: { by: string; value: number; result: "higher" | "lower" | "correct" }[];
    secret: number | null;
    winner: string | null;
  };
  // 連打バトル：counts は全員の回数。deadlineIn は「スタート」まで／終わるまで（ミリ秒）
  tap: null | {
    phase: "count" | "run" | "done";
    counts: Record<string, number>;
    deadlineIn: number | null;
  };
  // 反射神経バトル：GO の前は deadlineIn が null（待ち時間を見せない）
  reflex: null | {
    round: number;
    total: number;
    phase: "wait" | "go" | "revealed" | "done";
    reacted: string[];
    falseStart: string[];
    myMs: number | null;
    scores: Record<string, number>;
    last: { round: number; winner: string | null; times: Record<string, number | null>; falseStart: string[] } | null;
    deadlineIn: number | null;
  };
};

export type Member = {
  id: string;
  username: string;
  displayName: string;
  hasAvatar: boolean;
  avatarVersion?: string | null;
  role: "owner" | "member";
};

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  contact: string;
  profileUrl: string;
  hasAvatar: boolean;
  coverTheme: CoverTheme;
  isFriend: boolean;
  friendship: FriendshipState;
  note: string | null;
  // いまのノートのID（詳細を開くときに使う）
  noteId: string | null;
};

// 友だち一覧の1人分（bio はステータスメッセージとして表示する）
export type Friend = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
  coverTheme: CoverTheme;
  // 有効期限の内にあるノート（なければ null）
  note?: { id: string; body: string; expiresAt: string } | null;
};

// ノートの詳細（ノートを開いたとき）
export type NotePerson = {
  id: string;
  username: string;
  displayName: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
};

export type NoteDetail = {
  id: string;
  body: string;
  expiresAt: string;
  owner: NotePerson;
  isMine: boolean;
  likeCount: number;
  likedByMe: boolean;
  // いいねした人（ノートの本人にだけ届く。ほかの人には null）
  likers: (NotePerson & { likedAt: string })[] | null;
  comments: { id: string; body: string; createdAt: string; mine: boolean; canDelete: boolean; author: NotePerson }[];
};

// 1対1の相手とのフレンド関係（自分から見た状態）
export type FriendshipState = "friend" | "incoming" | "outgoing" | "none";

// 利用停止（BAN）の内容。until が null なら永久
export type BanInfo = { until: string | null; permanent: boolean; reason: string | null };
