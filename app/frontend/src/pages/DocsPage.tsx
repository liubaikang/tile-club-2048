import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'markdown-to-jsx';
import { ArrowLeft, Check, Copy, List, Printer } from 'lucide-react';
import processMarkdown from '@/content/development-process.md?raw';
import { buildToc, slugify } from '@/lib/toc';

const toc = buildToc(processMarkdown);

const heading = (level: 2 | 3) => {
  const Tag = `h${level}` as 'h2' | 'h3';
  const Component = ({ children }: { children?: ReactNode }) => {
    const label = typeof children === 'string' ? children : String(children ?? '');
    return (
      <Tag id={slugify(label)} className="scroll-mt-24">
        {children}
      </Tag>
    );
  };
  Component.displayName = `Heading${level}`;
  return Component;
};

const DocsPage = () => {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? '');
  const [copied, setCopied] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const targets = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: [0, 1] },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const options = useMemo(
    () => ({
      forceBlock: true,
      overrides: {
        h1: { component: heading(2) },
        h2: { component: heading(2) },
        h3: { component: heading(3) },
        table: {
          props: { className: 'docs-table' },
        },
        a: {
          props: { className: 'font-medium text-[#B1432E] underline underline-offset-4' },
        },
        code: {
          props: { className: 'rounded bg-[#F1E9DA] px-1.5 py-0.5 text-[0.9em] text-[#8C3120]' },
        },
        pre: {
          props: {
            className:
              'overflow-x-auto rounded-xl bg-[#241A12] p-4 text-[12.5px] leading-relaxed text-[#F7F2E7]',
          },
        },
        hr: { props: { className: 'my-10 border-[#E3D6C3]' } },
      },
    }),
    [],
  );

  const copyLink = async () => {
    const url = `${window.location.origin}/docs${activeId ? `#${activeId}` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const nav = (
    <nav aria-label="文档目录" className="space-y-1">
      {toc.map((entry) => {
        const active = entry.id === activeId;
        return (
          <a
            key={entry.id}
            href={`#${entry.id}`}
            onClick={() => setTocOpen(false)}
            aria-current={active ? 'true' : undefined}
            className={[
              'block border-l-2 py-1.5 text-[12.5px] leading-snug transition-colors',
              entry.level === 2 ? 'pl-3 font-medium' : 'pl-6',
              active
                ? 'border-[#D4643F] text-[#241A12]'
                : 'border-transparent text-[#6C5A4A] hover:border-[#C7AC8C] hover:text-[#241A12]',
            ].join(' ')}
          >
            {entry.label}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="paper-grain min-h-screen">
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="pill pill-ghost">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            返回游戏
          </Link>
          <div className="flex items-center gap-2">
            <button className="pill pill-secondary" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? '已复制' : '复制链接'}
            </button>
            <button className="pill pill-ghost" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              打印
            </button>
          </div>
        </header>

        <div className="mt-8 border-b border-[#E3D6C3] pb-6">
          <p className="label-caps">TILE CLUB / 文档</p>
          <h1 className="display-font mt-2 text-[36px] leading-tight text-[#241A12] sm:text-[46px]">
            生成过程
            <span className="text-[#D4643F]">文档</span>
          </h1>
          <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-[#6C5A4A]">
            14 个阶段的完整执行记录：每阶段的目标、具体执行计划、产出物、验收标准，以及实际遇到的问题与处理方式。
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
          <aside className="lg:w-[236px] lg:shrink-0">
            <div className="club-card p-4 lg:sticky lg:top-6">
              <div className="flex items-center justify-between">
                <p className="label-caps">目录 · {toc.length} 节</p>
                <button
                  className="flex items-center gap-1 text-[11px] font-medium text-[#6C5A4A] lg:hidden"
                  onClick={() => setTocOpen((open) => !open)}
                  aria-expanded={tocOpen}
                >
                  <List className="h-3.5 w-3.5" aria-hidden="true" />
                  {tocOpen ? '收起' : '展开'}
                </button>
              </div>
              <div className={`mt-3 max-h-[26vh] overflow-y-auto pr-1 lg:max-h-[calc(100vh-180px)] ${tocOpen ? 'block' : 'hidden lg:block'}`}>
                {nav}
              </div>
            </div>
          </aside>

          <article className="club-card min-w-0 flex-1 p-6 sm:p-8">
            <div className="docs-prose">
              <Markdown options={options}>{processMarkdown}</Markdown>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;