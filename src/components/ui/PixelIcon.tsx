/**
 * Pixel Art Icon Library — 8×8 grid icons for MineSync.
 * Each icon is drawn on an 8×8 pixel grid for a chunky retro feel.
 * Compatible with the Lucide React icon API (size, className, style).
 */
import type { SVGAttributes, ReactNode } from "react";

/* ── Types ── */

interface PixelIconProps extends SVGAttributes<SVGSVGElement> {
  size?: number;
  strokeWidth?: number; // ignored — Lucide compat
}

export type IconComponent = (props: PixelIconProps) => ReactNode;

/* ── Grid → SVG path helper ── */

function g(rows: string[]): string {
  const d: string[] = [];
  for (let y = 0; y < rows.length; y++) {
    let x = 0;
    while (x < rows[y].length) {
      if (rows[y][x] === "#") {
        let run = 1;
        while (x + run < rows[y].length && rows[y][x + run] === "#") run++;
        d.push(`M${String(x)},${String(y)}h${String(run)}v1H${String(x)}z`);
        x += run;
      } else {
        x++;
      }
    }
  }
  return d.join("");
}

/* ── Icon factory ── */

function make(grid: string[]): IconComponent {
  const d = g(grid);
  const s = grid.length;

  return function PxIcon({
    size = 24,
    strokeWidth: _strokeWidth,
    className,
    style,
    ...rest
  }: PixelIconProps): ReactNode {
    void _strokeWidth;
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${String(s)} ${String(s)}`}
        fill="currentColor"
        shapeRendering="crispEdges"
        className={className}
        style={style}
        {...rest}
      >
        <path d={d} />
      </svg>
    );
  };
}

/* ═══════════════════════════════════════════
   Icon definitions — 8×8 pixel grids
   '#' = filled pixel, '.' = empty
   ═══════════════════════════════════════════ */

export const Home = make([
  "...##...",
  "..####..",
  ".##..##.",
  "########",
  "##....##",
  "##.##.##",
  "##.##.##",
  "########",
]);

export const Search = make([
  ".####...",
  "#....#..",
  "#....#..",
  "#....#..",
  ".####...",
  "...##...",
  "....##..",
  ".....##.",
]);

export const Layers = make([
  "..####..",
  ".######.",
  "........",
  ".######.",
  "########",
  "........",
  "########",
  "########",
]);

export const RefreshCw = make([
  "..#####.",
  ".#....#.",
  "#.....#.",
  "......#.",
  ".#......",
  ".#.....#",
  ".#....#.",
  ".#####..",
]);

export const Settings = make([
  ".#.##.#.",
  "########",
  "##.##.##",
  ".######.",
  ".######.",
  "##.##.##",
  "########",
  ".#.##.#.",
]);

export const User = make([
  "..####..",
  "..####..",
  "..####..",
  "...##...",
  ".######.",
  "########",
  "########",
  "........",
]);

export const Minus = make([
  "........",
  "........",
  "........",
  "########",
  "########",
  "........",
  "........",
  "........",
]);

export const Square = make([
  "########",
  "#......#",
  "#......#",
  "#......#",
  "#......#",
  "#......#",
  "#......#",
  "########",
]);

export const X = make([
  "##....##",
  ".##..##.",
  "..####..",
  "...##...",
  "..####..",
  ".##..##.",
  "##....##",
  "........",
]);

export const Plus = make([
  "...##...",
  "...##...",
  "...##...",
  "########",
  "########",
  "...##...",
  "...##...",
  "...##...",
]);

export const Play = make([
  "##......",
  "####....",
  "######..",
  "########",
  "########",
  "######..",
  "####....",
  "##......",
]);

export const Loader2 = make([
  "..####..",
  ".##..##.",
  "##....##",
  "#......#",
  "#......#",
  "##......",
  ".##.....",
  "..####..",
]);

export const AlertCircle = make([
  "..####..",
  ".#.##.#.",
  "#..##..#",
  "#..##..#",
  "#......#",
  "#..##..#",
  ".#....#.",
  "..####..",
]);

export const Gamepad2 = make([
  "........",
  ".######.",
  "########",
  "###..###",
  "########",
  "########",
  "..#..#..",
  "..####..",
]);

export const Trash2 = make([
  "...##...",
  ".######.",
  "........",
  ".######.",
  ".#.##.#.",
  ".#.##.#.",
  ".#....#.",
  ".######.",
]);

export const MoreVertical = make([
  "...##...",
  "...##...",
  "........",
  "...##...",
  "...##...",
  "........",
  "...##...",
  "...##...",
]);

export const Download = make([
  "...##...",
  "...##...",
  "...##...",
  ".######.",
  "..####..",
  "...##...",
  "........",
  "########",
]);

export const Package = make([
  "########",
  "#..##..#",
  "#..##..#",
  "########",
  "#......#",
  "#......#",
  "#......#",
  "########",
]);

export const ChevronLeft = make([
  "....##..",
  "...##...",
  "..##....",
  ".##.....",
  "..##....",
  "...##...",
  "....##..",
  "........",
]);

export const ChevronRight = make([
  "..##....",
  "...##...",
  "....##..",
  ".....##.",
  "....##..",
  "...##...",
  "..##....",
  "........",
]);

export const SlidersHorizontal = make([
  "........",
  "..#.####",
  "..#.####",
  "........",
  "####.#..",
  "####.#..",
  "........",
  "........",
]);

export const Boxes = make([
  "####.###",
  "#..#.#.#",
  "####.###",
  "........",
  "###.####",
  "#.#.#..#",
  "###.####",
  "........",
]);

export const LogIn = make([
  "...#####",
  "...#...#",
  "##.#...#",
  "####...#",
  "####...#",
  "##.#...#",
  "...#...#",
  "...#####",
]);

export const LogOut = make([
  "#####...",
  "#...#...",
  "#...#.##",
  "#...####",
  "#...####",
  "#...#.##",
  "#...#...",
  "#####...",
]);

export const Copy = make([
  "..######",
  "..#....#",
  "..#....#",
  "######.#",
  "#....###",
  "#....#..",
  "#....#..",
  "######..",
]);

export const Check = make([
  "........",
  ".......#",
  "......##",
  "#....##.",
  "##..##..",
  ".####...",
  "..##....",
  "........",
]);

export const ExternalLink = make([
  "....####",
  "....#..#",
  "...##...",
  "..##....",
  ".##.....",
  "##.#....",
  "#..#....",
  "########",
]);

export const Share2 = make([
  ".....##.",
  ".....##.",
  "...##...",
  ".##.....",
  ".##.....",
  "...##...",
  ".....##.",
  ".....##.",
]);

export const ArrowDownToLine = make([
  "...##...",
  "...##...",
  "...##...",
  ".######.",
  "..####..",
  "...##...",
  "........",
  "########",
]);

export const Wifi = make([
  ".######.",
  "#......#",
  "..####..",
  ".#....#.",
  "...##...",
  "........",
  "...##...",
  "...##...",
]);

export const WifiOff = make([
  "#.####..",
  ".#....#.",
  "..####.#",
  ".#...##.",
  "..###...",
  "...#....",
  "..###...",
  "...##...",
]);

export const ArrowUpDown = make([
  "...##...",
  "..####..",
  ".######.",
  "...##...",
  "...##...",
  ".######.",
  "..####..",
  "...##...",
]);

export const AlertTriangle = make([
  "...##...",
  "...##...",
  "..####..",
  "..#..#..",
  ".##..##.",
  ".#.##.#.",
  "########",
  "........",
]);

export const History = make([
  "..####..",
  ".#....#.",
  "#..#..#.",
  "#..##.#.",
  "#...####",
  "#......#",
  ".#....#.",
  "..####..",
]);

export const FolderOpen = make([
  ".###....",
  ".#..####",
  "########",
  "########",
  "#......#",
  "#......#",
  "#......#",
  "########",
]);

export const HardDrive = make([
  "........",
  "########",
  "#......#",
  "#......#",
  "########",
  "#..#.#.#",
  "#..#.#.#",
  "########",
]);

export const Cpu = make([
  ".#.##.#.",
  "########",
  "#.####.#",
  "##.##.##",
  "##.##.##",
  "#.####.#",
  "########",
  ".#.##.#.",
]);

export const Info = make([
  "..####..",
  ".#....#.",
  "#..##..#",
  "#......#",
  "#..##..#",
  "#..##..#",
  ".#....#.",
  "..####..",
]);

export const ArrowLeft = make([
  "........",
  "..#.....",
  ".##.....",
  "########",
  "########",
  ".##.....",
  "..#.....",
  "........",
]);

export const CheckCircle2 = make([
  "..####..",
  ".#....#.",
  "#.....##",
  "#...##.#",
  "##.##..#",
  ".###...#",
  ".#....#.",
  "..####..",
]);
