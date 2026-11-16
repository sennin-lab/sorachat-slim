import { Icon } from "./Icon";
import { useExitClose } from "./useExitClose";

// 「＋」から開く添付メニュー。slim 版は「連絡先」と「投票」だけ（写真・ファイル・ミニゲームは無い）
export function AttachSheet({
  onContact,
  onPoll,
  onClose
}: {
  onContact: () => void;
  onPoll: () => void;
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
        <button className="cancel" onClick={() => close()}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
