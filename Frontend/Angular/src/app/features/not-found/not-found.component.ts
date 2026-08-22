import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="content">
        <!-- 404 SVG illustration -->
        <svg
          class="illustration"
          viewBox="0 0 520 300"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="g404" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1a4731" />
              <stop offset="100%" stop-color="#0D2B1D" />
            </linearGradient>
            <filter id="soft-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <!-- Ground line -->
          <line
            x1="40"
            y1="265"
            x2="480"
            y2="265"
            stroke="rgba(74,222,128,0.2)"
            stroke-width="1"
            stroke-dasharray="6 4"
          />

          <!-- "4" left -->
          <g class="digit slide-left">
            <rect
              x="55"
              y="80"
              width="16"
              height="140"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
            <rect
              x="55"
              y="145"
              width="72"
              height="16"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
            <rect
              x="111"
              y="80"
              width="16"
              height="90"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
          </g>

          <!-- "0" center (broken circle) -->
          <g class="digit pulse-scale">
            <!-- outer ring -->
            <circle cx="260" cy="150" r="65" fill="url(#g404)" stroke="#C8A96E" stroke-width="2" />
            <!-- inner hole -->
            <circle cx="260" cy="150" r="38" fill="#060d09" />
            <!-- crack lines -->
            <path
              d="M260 85 L255 100 L265 110 L258 120"
              stroke="#C8A96E"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M325 150 L310 147 L305 155 L295 150"
              stroke="#C8A96E"
              stroke-width="2"
              stroke-linecap="round"
            />
            <!-- question mark inside -->
            <text
              x="260"
              y="162"
              text-anchor="middle"
              fill="#C8A96E"
              font-size="32"
              font-family="Outfit,sans-serif"
              font-weight="700"
            >
              ?
            </text>
            <!-- glow ring -->
            <circle
              cx="260"
              cy="150"
              r="65"
              fill="none"
              stroke="#C8A96E"
              stroke-width="8"
              opacity="0.06"
              filter="url(#soft-glow)"
            />
          </g>

          <!-- "4" right -->
          <g class="digit slide-right">
            <rect
              x="365"
              y="80"
              width="16"
              height="140"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
            <rect
              x="365"
              y="145"
              width="72"
              height="16"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
            <rect
              x="421"
              y="80"
              width="16"
              height="90"
              rx="5"
              fill="url(#g404)"
              stroke="#4ade80"
              stroke-width="1.5"
            />
          </g>

          <!-- Scanning beam -->
          <rect
            x="0"
            y="0"
            width="520"
            height="3"
            rx="1.5"
            fill="rgba(74,222,128,0.5)"
            class="scan-beam"
          />

          <!-- Radar ping circles -->
          <circle
            cx="260"
            cy="150"
            r="80"
            fill="none"
            stroke="rgba(74,222,128,0.15)"
            stroke-width="1"
            class="ping p1"
          />
          <circle
            cx="260"
            cy="150"
            r="100"
            fill="none"
            stroke="rgba(74,222,128,0.08)"
            stroke-width="1"
            class="ping p2"
          />
          <circle
            cx="260"
            cy="150"
            r="120"
            fill="none"
            stroke="rgba(74,222,128,0.04)"
            stroke-width="1"
            class="ping p3"
          />

          <!-- Stars/particles -->
          <circle cx="110" cy="55" r="2" fill="#C8A96E" opacity="0.6" class="twinkle t1" />
          <circle cx="400" cy="48" r="2" fill="#4ade80" opacity="0.5" class="twinkle t2" />
          <circle cx="480" cy="190" r="2" fill="#C8A96E" opacity="0.4" class="twinkle t3" />
          <circle cx="42" cy="210" r="1.5" fill="#4ade80" opacity="0.5" class="twinkle t1" />
          <circle cx="300" cy="40" r="1.5" fill="#C8A96E" opacity="0.3" class="twinkle t2" />
        </svg>

        <div class="badge">Error 404</div>
        <h1>Target Not Found</h1>
        <p>
          The resource you're looking for is outside the operational perimeter.<br />Verify the URL
          and try again.
        </p>

        <div class="actions">
          <a routerLink="/home" class="btn-primary">← Return to Base</a>
          <a routerLink="/login" class="btn-ghost">Sign In</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: 'Outfit', sans-serif;
      }

      .page {
        min-height: 100vh;
        background:
          radial-gradient(ellipse at 50% 40%, rgba(26, 71, 49, 0.6) 0%, transparent 70%),
          linear-gradient(180deg, #060d09 0%, #0d2b1d 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .content {
        text-align: center;
        max-width: 540px;
        animation: fadeIn 0.5s ease both;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .illustration {
        width: min(480px, 100%);
        margin-bottom: 1.5rem;
      }

      .badge {
        display: inline-block;
        background: rgba(74, 222, 128, 0.1);
        border: 1px solid rgba(74, 222, 128, 0.3);
        color: #4ade80;
        padding: 0.35rem 1rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 1rem;
      }
      h1 {
        font-size: clamp(2.2rem, 7vw, 3.5rem);
        font-weight: 700;
        color: #fff;
        margin: 0 0 1rem;
        letter-spacing: -0.01em;
      }
      p {
        color: rgba(255, 255, 255, 0.6);
        font-size: 1.05rem;
        line-height: 1.7;
        margin: 0 0 2rem;
      }

      .actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
      }
      .btn-primary {
        background: #c8a96e;
        color: #0d2b1d;
        border: none;
        padding: 0.85rem 2rem;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.95rem;
        text-decoration: none;
        font-family: 'Outfit', sans-serif;
        transition:
          background 0.2s,
          transform 0.2s;
      }
      .btn-primary:hover {
        background: #ddb96e;
        transform: translateY(-2px);
      }
      .btn-ghost {
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        border: 1.5px solid rgba(255, 255, 255, 0.28);
        padding: 0.85rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        text-decoration: none;
        font-family: 'Outfit', sans-serif;
        transition: border-color 0.2s;
      }
      .btn-ghost:hover {
        border-color: rgba(255, 255, 255, 0.6);
      }

      /* SVG animations */
      .slide-left {
        animation: slideInLeft 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .slide-right {
        animation: slideInRight 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both 0.1s;
      }
      @keyframes slideInLeft {
        from {
          opacity: 0;
          transform: translateX(-30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(30px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .pulse-scale {
        animation: pulseBob 3s ease-in-out infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes pulseBob {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.03);
        }
      }

      .scan-beam {
        animation: scanDown 3.5s linear infinite;
      }
      @keyframes scanDown {
        0% {
          transform: translateY(-10px);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 0.4;
        }
        100% {
          transform: translateY(310px);
          opacity: 0;
        }
      }

      .ping {
        animation: pingOut 3s ease-out infinite;
      }
      .p2 {
        animation-delay: 0.5s;
      }
      .p3 {
        animation-delay: 1s;
      }
      @keyframes pingOut {
        0% {
          opacity: 1;
          transform: scale(1);
          transform-box: fill-box;
          transform-origin: 260px 150px;
        }
        100% {
          opacity: 0;
          transform: scale(1.35);
          transform-box: fill-box;
          transform-origin: 260px 150px;
        }
      }

      .twinkle {
        animation: twinkleAnim 2s ease-in-out infinite;
      }
      .t2 {
        animation-delay: 0.7s;
      }
      .t3 {
        animation-delay: 1.4s;
      }
      @keyframes twinkleAnim {
        0%,
        100% {
          opacity: 0.2;
        }
        50% {
          opacity: 0.9;
        }
      }
    `,
  ],
})
export class NotFoundComponent {}
