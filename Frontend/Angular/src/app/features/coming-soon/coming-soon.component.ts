import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="content">
        <!-- Animated construction SVG -->
        <svg
          class="illustration"
          viewBox="0 0 480 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#1a4731" />
              <stop offset="100%" stop-color="#0D2B1D" />
            </linearGradient>
            <linearGradient id="stripeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#C8A96E" />
              <stop offset="100%" stop-color="#e8c87e" />
            </linearGradient>
          </defs>

          <!-- Background circle -->
          <circle cx="240" cy="160" r="130" fill="url(#bgGrad)" opacity="0.8" />
          <circle
            cx="240"
            cy="160"
            r="130"
            fill="none"
            stroke="#4ade80"
            stroke-width="1.5"
            opacity="0.3"
          />
          <circle
            cx="240"
            cy="160"
            r="110"
            fill="none"
            stroke="#4ade80"
            stroke-width="0.8"
            opacity="0.15"
            class="spin-slow"
          />

          <!-- Construction cone -->
          <g class="cone-group">
            <!-- cone body -->
            <polygon
              points="240,90 270,190 210,190"
              fill="#C8A96E"
              stroke="#a88a50"
              stroke-width="1.5"
            />
            <!-- stripes -->
            <clipPath id="coneClip">
              <polygon points="240,90 270,190 210,190" />
            </clipPath>
            <rect
              x="205"
              y="120"
              width="70"
              height="14"
              fill="white"
              opacity="0.5"
              clip-path="url(#coneClip)"
            />
            <rect
              x="205"
              y="152"
              width="70"
              height="14"
              fill="white"
              opacity="0.5"
              clip-path="url(#coneClip)"
            />
            <!-- base -->
            <rect x="200" y="190" width="80" height="12" rx="3" fill="#a88a50" />
          </g>

          <!-- Wrench left -->
          <g class="wrench-left" transform-origin="180 150">
            <path
              d="M155 130 C148 123 148 112 155 105 C160 100 168 99 174 102 L163 113 L167 117 L178 106 C181 112 180 120 175 125 C168 132 158 133 155 130 Z"
              fill="#4ade80"
              stroke="#2d7a56"
              stroke-width="1.5"
            />
            <rect
              x="172"
              y="122"
              width="10"
              height="38"
              rx="3"
              fill="#4ade80"
              stroke="#2d7a56"
              stroke-width="1.2"
              transform="rotate(45,177,141)"
            />
          </g>

          <!-- Wrench right -->
          <g class="wrench-right" transform-origin="300 150">
            <path
              d="M325 130 C332 123 332 112 325 105 C320 100 312 99 306 102 L317 113 L313 117 L302 106 C299 112 300 120 305 125 C312 132 322 133 325 130 Z"
              fill="#C8A96E"
              stroke="#a88a50"
              stroke-width="1.5"
            />
            <rect
              x="298"
              y="122"
              width="10"
              height="38"
              rx="3"
              fill="#C8A96E"
              stroke="#a88a50"
              stroke-width="1.2"
              transform="rotate(-45,303,141)"
            />
          </g>

          <!-- Gear top-left -->
          <g class="gear-spin" transform="translate(120,85)">
            <circle r="18" fill="#1a4731" stroke="#4ade80" stroke-width="2" />
            <circle r="8" fill="#0D2B1D" stroke="#4ade80" stroke-width="1.5" />
            <rect x="-4" y="-22" width="8" height="8" rx="2" fill="#4ade80" />
            <rect x="-4" y="14" width="8" height="8" rx="2" fill="#4ade80" />
            <rect x="-22" y="-4" width="8" height="8" rx="2" fill="#4ade80" />
            <rect x="14" y="-4" width="8" height="8" rx="2" fill="#4ade80" />
            <rect x="-17" y="-17" width="6" height="6" rx="1" fill="#4ade80" />
            <rect x="11" y="-17" width="6" height="6" rx="1" fill="#4ade80" />
            <rect x="-17" y="11" width="6" height="6" rx="1" fill="#4ade80" />
            <rect x="11" y="11" width="6" height="6" rx="1" fill="#4ade80" />
          </g>

          <!-- Gear bottom-right (counter spin) -->
          <g class="gear-counter" transform="translate(360,235)">
            <circle r="14" fill="#1a4731" stroke="#C8A96E" stroke-width="1.5" />
            <circle r="6" fill="#0D2B1D" stroke="#C8A96E" stroke-width="1.2" />
            <rect x="-3" y="-18" width="6" height="6" rx="1.5" fill="#C8A96E" />
            <rect x="-3" y="12" width="6" height="6" rx="1.5" fill="#C8A96E" />
            <rect x="-18" y="-3" width="6" height="6" rx="1.5" fill="#C8A96E" />
            <rect x="12" y="-3" width="6" height="6" rx="1.5" fill="#C8A96E" />
          </g>

          <!-- Dots / particles -->
          <circle cx="90" cy="200" r="3" fill="#4ade80" opacity="0.4" class="float1" />
          <circle cx="390" cy="100" r="4" fill="#C8A96E" opacity="0.5" class="float2" />
          <circle cx="420" cy="220" r="2.5" fill="#4ade80" opacity="0.3" class="float3" />
          <circle cx="70" cy="120" r="2" fill="#C8A96E" opacity="0.4" class="float1" />
        </svg>

        <div class="badge">Under Construction</div>
        <h1>Coming Soon</h1>
        <p>
          This feature is being built to mission specs. <br />Check back with your CO for an ETA.
        </p>

        <!-- Progress bar -->
        <div class="progress-track">
          <div class="progress-fill"></div>
        </div>
        <span class="progress-label">Development in Progress</span>

        <div class="actions">
          <a routerLink="/home" class="btn-primary">← Return Home</a>
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
        background: linear-gradient(160deg, #0d2b1d 0%, #1a4731 50%, #070f0b 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
      }
      .content {
        text-align: center;
        max-width: 520px;
        animation: fadeUp 0.6s ease both;
      }
      @keyframes fadeUp {
        from {
          opacity: 0;
          transform: translateY(24px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .illustration {
        width: min(420px, 100%);
        margin-bottom: 2rem;
      }

      .badge {
        display: inline-block;
        background: rgba(200, 169, 110, 0.15);
        border: 1px solid rgba(200, 169, 110, 0.4);
        color: #c8a96e;
        padding: 0.35rem 1rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 1rem;
      }
      h1 {
        font-size: clamp(2.5rem, 8vw, 4rem);
        font-weight: 700;
        color: #fff;
        margin: 0 0 1rem;
      }
      p {
        color: rgba(255, 255, 255, 0.62);
        font-size: 1.05rem;
        line-height: 1.7;
        margin: 0 0 1.75rem;
      }

      .progress-track {
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 100px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }
      .progress-fill {
        height: 100%;
        width: 0;
        border-radius: 100px;
        background: linear-gradient(90deg, #2d7a56, #c8a96e);
        animation: fillBar 2.8s ease-out forwards;
      }
      @keyframes fillBar {
        to {
          width: 68%;
        }
      }
      .progress-label {
        font-size: 0.78rem;
        color: rgba(255, 255, 255, 0.35);
        letter-spacing: 0.08em;
      }

      .actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 2rem;
      }
      .btn-primary {
        background: #c8a96e;
        color: #0d2b1d;
        border: none;
        padding: 0.85rem 2rem;
        border-radius: 8px;
        font-weight: 700;
        font-size: 0.95rem;
        cursor: pointer;
        font-family: 'Outfit', sans-serif;
        text-decoration: none;
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
        color: rgba(255, 255, 255, 0.75);
        border: 1.5px solid rgba(255, 255, 255, 0.3);
        padding: 0.85rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        text-decoration: none;
        font-family: 'Outfit', sans-serif;
        transition: border-color 0.2s;
      }
      .btn-ghost:hover {
        border-color: rgba(255, 255, 255, 0.65);
      }

      /* SVG animations */
      .gear-spin {
        animation: rotateCW 5s linear infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      .gear-counter {
        animation: rotateCCW 4s linear infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes rotateCW {
        to {
          transform: rotate(360deg);
        }
      }
      @keyframes rotateCCW {
        to {
          transform: rotate(-360deg);
        }
      }

      .wrench-left {
        animation: swingLeft 1.8s ease-in-out infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      .wrench-right {
        animation: swingRight 1.8s ease-in-out infinite;
        transform-box: fill-box;
        transform-origin: center;
      }
      @keyframes swingLeft {
        0%,
        100% {
          transform: rotate(-10deg);
        }
        50% {
          transform: rotate(10deg);
        }
      }
      @keyframes swingRight {
        0%,
        100% {
          transform: rotate(10deg);
        }
        50% {
          transform: rotate(-10deg);
        }
      }

      .spin-slow {
        animation: rotateCW 20s linear infinite;
        transform-box: fill-box;
        transform-origin: 240px 160px;
      }

      .float1 {
        animation: floatY 3s ease-in-out infinite;
      }
      .float2 {
        animation: floatY 2.5s ease-in-out infinite 0.4s;
      }
      .float3 {
        animation: floatY 3.5s ease-in-out infinite 0.8s;
      }
      @keyframes floatY {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-8px);
        }
      }
    `,
  ],
})
export class ComingSoonComponent {}
