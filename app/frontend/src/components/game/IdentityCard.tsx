import { useState } from 'react';
import { LogIn, LogOut, Pencil, ShieldCheck, UserRound, Loader2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

interface InputDialogProps {
  open: boolean;
  title: string;
  description: string;
  initialValue: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}

export const NameDialog = ({
  open,
  title,
  description,
  initialValue,
  confirmLabel,
  onCancel,
  onConfirm,
}: InputDialogProps) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!value.trim()) {
      setError('昵称不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(36,26,18,0.4)] p-4">
      <div className="overlay-card w-full max-w-[380px] rounded-2xl border border-[#E3D6C3] bg-[#FFFDF8] p-6 shadow-xl">
        <h2 className="display-font text-[26px] text-[#241A12]">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6C5A4A]">{description}</p>
        <input
          className="text-input mt-4"
          value={value}
          maxLength={24}
          autoFocus
          aria-label="昵称"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
            if (event.key === 'Escape') onCancel();
          }}
        />
        {error && <p className="mt-2 text-[12px] text-[#A63D25]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="pill pill-ghost" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button className="pill pill-primary" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const IdentityCard = () => {
  const {
    displayName,
    isGuest,
    isAuthenticated,
    accountEmail,
    guestDeviceTag,
    login,
    logout,
    rename,
    profile,
  } = usePlayer();
  const [renaming, setRenaming] = useState(false);

  const initial = displayName.trim().charAt(0).toUpperCase() || 'G';

  return (
    <section className="club-card p-5" aria-label="玩家身份">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EFE6D6] text-[16px] font-semibold text-[#3D2F27]"
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-semibold text-[#241A12]">{displayName}</p>
            {isAuthenticated && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4643F]" aria-label="已登录账户" />
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[#6C5A4A]">
            {isGuest ? `游客身份 · 设备 ${guestDeviceTag}` : accountEmail}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[12px] text-[#6C5A4A]">
        <span className="rounded-full bg-[#F1E9DA] px-2 py-1">
          {isGuest ? <UserRound className="mr-1 inline h-3 w-3" aria-hidden="true" /> : null}
          {isGuest ? '游客模式' : '正式账户'}
        </span>
        <span>{profile?.stats.games_played ?? 0} 局记录</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {isGuest ? (
          <button className="pill pill-primary flex-1" onClick={login}>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            登录 / 注册
          </button>
        ) : (
          <button className="pill pill-secondary flex-1" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            退出登录
          </button>
        )}
        <button className="pill pill-ghost" onClick={() => setRenaming(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          昵称
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[#9C8875]">
        {isGuest
          ? '游客身份由本设备的浏览器信息生成，成绩会自动归档到同一身份。'
          : '账户成绩将与你的身份绑定，可在任意设备登录后继续查看。'}
      </p>

      <NameDialog
        open={renaming}
        title="修改昵称"
        description="昵称会显示在排行榜上，历史成绩将同步更新。"
        initialValue={displayName}
        confirmLabel="保存"
        onCancel={() => setRenaming(false)}
        onConfirm={async (value) => {
          await rename(value);
          setRenaming(false);
        }}
      />
    </section>
  );
};

export default IdentityCard;