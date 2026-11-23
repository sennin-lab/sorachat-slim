import { Icon } from "./Icon";
import { useExitClose } from "./useExitClose";

// 「＋」から開く添付メニュー（連絡先・投票・ミニゲーム）
export function AttachSheet({
  onContact,
  onPoll,
  onGame,
  onStamp,
  onClose
}: {
  onContact: () => void;
  onPoll: () => void;
  onStamp?: () => void;
  // グループのトークでだけ出す「ミニゲーム」
  onGame?: () => void;
  onClose: () => void;
}) {
  const { closing, close } = useExitClose(onClose);
  return (
    <div className={`sheet-backdrop${closing ? " is-closing" : ""}`} onClick={() => close()}>
      <div
        className={`sheet attach-sheet${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-label="添付"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-title-row">
          <span />
          <strong>添付</strong>
          <button type="button" className="icon-btn modal-x" onClick={() => close()} aria-label="閉じる">
            ×
          </button>
        </div>
        <button onClick={onContact}>
          <Icon name="card" size={22} /> <span>連絡先（SoraChat）</span>
        </button>
        <button onClick={onPoll}>
          <Icon name="poll" size={22} /> <span>投票</span>
        </button>
        {onStamp && (
          <button onClick={onStamp}>
            <Icon name="card" size={22} /> <span>スタンプ</span>
          </button>
        )}
        {onGame && (
          <button onClick={onGame}>
            <Icon name="game" size={22} /> <span>ミニゲーム</span>
          </button>
        )}
        <button className="cancel" onClick={() => close()}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
