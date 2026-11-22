interface ScoreCardProps {
  score: number;
  best: number;
  moves: number;
}

const ScoreCard = ({ score, best, moves }: ScoreCardProps) => (
  <section className="club-card p-5" aria-label="本局得分">
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="label-caps">本局得分</p>
        <p
          className="display-font mt-1 text-[42px] leading-none text-[#241A12] tabular-nums"
          aria-live="polite"
        >
          {score.toLocaleString()}
        </p>
      </div>
      <div className="h-12 w-px bg-[#E3D6C3]" aria-hidden="true" />
      <div className="text-right">
        <p className="label-caps">历史最佳</p>
        <p className="display-font mt-1 text-[42px] leading-none text-[#D4643F] tabular-nums">
          {best.toLocaleString()}
        </p>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-[#E3D6C3] pt-3 text-[12px] text-[#6C5A4A]">
      <span>已移动 {moves} 步</span>
      <span className="tabular-nums">目标瓦片 2048</span>
    </div>
  </section>
);

export default ScoreCard;