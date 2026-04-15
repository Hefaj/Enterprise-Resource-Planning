/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import {
  Component,
  ElementRef,
  HostListener,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  signal,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// PrimeNG v18+
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { Router } from '@angular/router';
import { ErpAuthService } from '@erp/shared/auth';

interface Point {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

// Zmieniony interfejs - dodano wsparcie dla osi Z (głębia przestrzeni 3D)
interface StaticStar {
  x: number;
  y: number;
  z: number;
  pz: number;
  size: number;
  alpha: number;
  twinkle: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  a: number;
  active: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, PasswordModule, CheckboxModule, MessageModule],
  template: `
    <div
      class="relative w-full h-screen overflow-hidden bg-[#010103] flex items-center justify-center font-sans select-none perspective-[1000px]"
    >
      <canvas
        #particleCanvas
        class="absolute inset-0 z-0 pointer-events-none transition-all duration-700"
        [style.filter]="loginError() ? 'blur(2px) brightness(1.2) saturate(2)' : 'none'"
      ></canvas>

      <div
        (mousedown)="$event.stopPropagation()"
        [class.login-error-state]="loginError()"
        [class.!scale-[3]]="isWarping()"
        [class.!opacity-0]="isWarping()"
        [class.pointer-events-none]="isWarping()"
        class="relative z-10 w-full max-w-[460px] mx-4 p-12
               bg-[#020617]/60 backdrop-blur-[24px] 
               border border-cyan-500/10 rounded-[3.5rem] 
               shadow-[0_0_60px_-15px_rgba(34,211,238,0.15)]
               transition-all duration-[1500ms] cubic-bezier(0.4, 0, 0.2, 1)
               hover:shadow-[0_0_80px_-15px_rgba(34,211,238,0.25)] 
               hover:border-cyan-500/20 group"
      >
        <div class="text-center mb-12">
          <div class="relative inline-flex mb-6 group-hover:scale-110 transition-transform duration-500">
            <div class="absolute inset-0 bg-cyan-500/30 blur-[40px] rounded-full animate-pulse"></div>
            <i
              class="pi pi-database text-6xl text-cyan-400 relative z-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
            ></i>
          </div>
          <h1 class="text-4xl font-black tracking-[0.25em] uppercase italic text-white drop-shadow-md">
            ERP<span class="text-cyan-500">.OS</span>
          </h1>
          <div class="h-[2px] w-20 bg-cyan-500/70 mx-auto mt-4 rounded-full"></div>
          <p class="text-slate-400 mt-5 text-[11px] font-bold tracking-[0.45em] uppercase">
            Distributed Systems Gateway
          </p>
        </div>

        <form
          (ngSubmit)="handleLogin()"
          class="flex flex-col gap-6"
        >
          <div class="space-y-5">
            <div class="flex flex-col gap-2 group/input">
              <span class="p-input-icon-left w-full relative">
                <i
                  class="pi pi-shield text-cyan-500/40 group-focus-within/input:text-cyan-400 transition-colors z-10"
                ></i>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="email"
                  name="email"
                  placeholder="Access Identity"
                  class="w-full !bg-black/30 !border-white/5 !text-white !rounded-2xl !p-5  focus:!bg-black/50 focus:!border-cyan-500/50 focus:!shadow-[0_0_20px_rgba(34,211,238,0.15)] !transition-all"
                />
              </span>
            </div>

            <div class="flex flex-col gap-2 group/input">
              <span class="relative w-full block">
                <p-password
                  [(ngModel)]="password"
                  name="password"
                  [toggleMask]="true"
                  [feedback]="false"
                  placeholder="Security Token"
                  styleClass="w-full"
                  inputStyleClass="w-full !bg-black/30 !border-white/5 !text-white !rounded-2xl !p-5 focus:!bg-black/50 focus:!border-cyan-500/50 focus:!shadow-[0_0_20px_rgba(34,211,238,0.15)] !transition-all"
                ></p-password>
              </span>
            </div>
          </div>

          <button
            pButton
            type="submit"
            [loading]="isLoading()"
            label="EXECUTE LOGIN"
            class="w-full !mt-3 !py-6 !rounded-2xl !bg-cyan-600 hover:!bg-cyan-500 !text-white !border-none !font-black !text-xs !tracking-[0.45em] !shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)] !transition-colors active:scale-95"
          ></button>
        </form>
      </div>

      <div
        class="absolute inset-0 z-50 bg-white pointer-events-none transition-opacity duration-1000"
        [class.opacity-100]="isWarpFlash()"
        [class.opacity-0]="!isWarpFlash()"
      ></div>
    </div>
  `,
  styles: [
    `
      :host {
        --primary-400: #22d3ee;
        --primary-500: #06b6d4;
        --primary-600: #0891b2;
      }
      ::ng-deep .p-checkbox .p-checkbox-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .login-error-state {
        border-color: rgba(239, 68, 68, 0.4) !important;
        box-shadow: 0 0 80px -20px rgba(239, 68, 68, 0.5) !important;
      }
    `,
  ],
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private _authService = inject(ErpAuthService);
  private _router = inject(Router);

  private ngZone = inject(NgZone); // Optymalizacja Enterprise dla Canvas

  email = '';
  password = '';
  isLoading = signal(false);
  loginError = signal(false);
  isWarping = signal(false); // Nowy state: tryb lotu
  isWarpFlash = signal(false); // Nowy state: błysk przejścia do MFE

  private ctx!: CanvasRenderingContext2D;
  private points: Point[] = [];
  private staticStars: StaticStar[] = [];
  private ripples: Ripple[] = [];
  private mouse = { x: -2000, y: -2000 };
  private readonly spacing = 52;
  private animationId: number = 0;
  private nebulaGradient!: CanvasGradient;

  // Parametry Warpu
  private warpSpeedBase = 0.5;
  private currentWarpSpeed = 0.5;
  private gridAlpha = 1.0; // Przezroczystość siatki pyłu - zanika w trakcie warpu

  ngAfterViewInit() {
    this.initCanvas();
    // Uruchamiamy poza Angular Zone, by nie triggerować Change Detection!
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  @HostListener('window:resize') onResize() {
    this.initCanvas();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (this.isWarping()) return;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  }

  @HostListener('window:mouseleave')
  onMouseLeave() {
    this.mouse.x = -2000;
    this.mouse.y = -2000;
  }

  @HostListener('window:mousedown', ['$event'])
  onClick(e: MouseEvent) {
    if (this.isWarping()) return;
    this.ripples.push({
      x: e.clientX,
      y: e.clientY,
      r: 0,
      a: 1.0,
      active: true,
    });
    if (this.ripples.length > 5) this.ripples.shift();
  }

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.nebulaGradient = this.ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.8,
    );
    this.nebulaGradient.addColorStop(0, '#0a0f1e');
    this.nebulaGradient.addColorStop(0.3, '#040914');
    this.nebulaGradient.addColorStop(0.6, '#010409');
    this.nebulaGradient.addColorStop(1, '#000002');

    // Inicjalizacja gwiazd z osią Z (przestrzeń 3D)
    this.staticStars = [];
    const starCount = Math.floor((canvas.width * canvas.height) / 800);
    for (let i = 0; i < starCount; i++) {
      this.staticStars.push({
        x: (Math.random() - 0.5) * canvas.width * 3, // Rozstrzał X
        y: (Math.random() - 0.5) * canvas.height * 3, // Rozstrzał Y
        z: Math.random() * canvas.width, // Głębokość Z
        pz: 0,
        size: Math.random() * 1.5,
        alpha: Math.random(),
        twinkle: Math.random() * 0.015,
      });
    }

    this.points = [];
    for (let x = 0; x < canvas.width + this.spacing; x += this.spacing) {
      for (let y = 0; y < canvas.height + this.spacing; y += this.spacing) {
        const jitterX = (Math.random() - 0.5) * 20;
        const jitterY = (Math.random() - 0.5) * 20;
        this.points.push({
          x: x + jitterX,
          y: y + jitterY,
          ox: x + jitterX,
          oy: y + jitterY,
          vx: 0,
          vy: 0,
        });
      }
    }
  }

  animate() {
    this.ctx.fillStyle = this.nebulaGradient;
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Logika przyśpieszenia Warp
    if (this.isWarping()) {
      this.currentWarpSpeed += (80 - this.currentWarpSpeed) * 0.05; // Płynne rozpędzanie do prędkości 80
      this.gridAlpha = Math.max(0, this.gridAlpha - 0.05); // Wygaszenie siatki
    } else {
      this.currentWarpSpeed = this.warpSpeedBase;
    }

    // 1. RENDEROWANIE GWIAZD 3D I EFEKTU WARP
    this.staticStars.forEach((star) => {
      star.pz = star.z;
      star.z -= this.currentWarpSpeed;

      // Reset gwiazdy, gdy minie kamerę
      if (star.z < 1) {
        star.z = window.innerWidth;
        star.pz = star.z;
        star.x = (Math.random() - 0.5) * window.innerWidth * 3;
        star.y = (Math.random() - 0.5) * window.innerHeight * 3;
      }

      const fov = 400;
      const px = cx + (star.x / star.z) * fov;
      const py = cy + (star.y / star.z) * fov;
      const ppx = cx + (star.x / star.pz) * fov;
      const ppy = cy + (star.y / star.pz) * fov;

      if (this.currentWarpSpeed > 2) {
        // Rysowanie smug świetlnych (Warp Trails)
        this.ctx.beginPath();
        this.ctx.moveTo(ppx, ppy);
        this.ctx.lineTo(px, py);
        this.ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(star.alpha + 0.3, 1)})`; // Cyjanowe smugi
        this.ctx.lineWidth = Math.max(0.5, star.size * (fov / star.z) * 0.8);
        this.ctx.stroke();
      } else {
        // Normalne migotanie
        star.alpha += star.twinkle;
        if (star.alpha > 1 || star.alpha < 0) star.twinkle = -star.twinkle;
        this.ctx.beginPath();
        this.ctx.arc(px, py, Math.max(0.1, star.size * (fov / star.z)), 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(star.alpha, 0)})`;
        this.ctx.fill();
      }
    });

    // 2. RENDEROWANIE FALI (RIPPLES)
    this.ripples.forEach((rip) => {
      if (rip.active) {
        rip.r += 12;
        rip.a -= 0.015;
        if (rip.a <= 0) rip.active = false;

        this.ctx.beginPath();
        this.ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.loginError()
          ? `rgba(239, 68, 68, ${rip.a * 0.6})`
          : `rgba(34, 211, 238, ${rip.a * 0.4})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
    });

    // 3. RENDEROWANIE SIATKI (Znika w trakcie Warp dla lepszej wydajności i efektu)
    if (this.gridAlpha > 0) {
      this.ctx.globalAlpha = this.gridAlpha;

      this.points.forEach((p) => {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const limit = 260;

        if (dist < limit) {
          const force = (limit - dist) / limit;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle + 0.4) * force * 1.2;
          p.vy -= Math.sin(angle + 0.4) * force * 1.2;
        }

        this.ripples.forEach((rip) => {
          if (rip.active) {
            const rdx = p.x - rip.x;
            const rdy = p.y - rip.y;
            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
            const diff = Math.abs(rdist - rip.r);
            if (diff < 60) {
              const ripForce = ((60 - diff) / 60) * rip.a;
              const ripAngle = Math.atan2(rdy, rdx);
              p.vx += Math.cos(ripAngle) * ripForce * 14;
              p.vy += Math.sin(ripAngle) * ripForce * 14;
            }
          }
        });

        p.vx += (p.ox - p.x) * 0.045;
        p.vy += (p.oy - p.y) * 0.045;
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.x += p.vx;
        p.y += p.vy;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        let color = '#334155';
        if (this.loginError()) color = `rgba(239, 68, 68, 0.8)`;
        else if (speed > 2.5) color = '#a855f7';
        else if (dist < limit) color = '#22d3ee';
        else if (speed > 0.8) color = '#3b82f6';

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();
      });

      this.ctx.lineWidth = 0.5;
      for (let i = 0; i < this.points.length; i++) {
        const p1 = this.points[i];
        for (let j = i + 1; j < Math.min(i + 15, this.points.length); j++) {
          const p2 = this.points[j];
          const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          if (dist < 65) {
            const alpha = (65 - dist) / 65;
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.strokeStyle = this.loginError()
              ? `rgba(239, 68, 68, ${alpha * 0.15})`
              : `rgba(34, 211, 238, ${alpha * 0.1})`;
            this.ctx.stroke();
          }
        }
      }
      this.ctx.globalAlpha = 1.0; // Reset
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  handleLogin() {
    this.isLoading.set(true);
    this.loginError.set(false);

    this.ripples.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      r: 0,
      a: 0.8,
      active: true,
    });

    setTimeout(() => {
      this.isLoading.set(false);

      if (this.password !== 'cosmic2026') {
        this.loginError.set(true);
        setTimeout(() => this.loginError.set(false), 2500);
      } else {
        // SUKCES: Aktywacja podróży nadświetlnej!
        this.isWarping.set(true);
        this.mouse.x = -2000; // Reset myszki

        // Finalny błysk i przekierowanie (symulacja przejścia do głównego MFE / Shell)
        setTimeout(() => {
          this.isWarpFlash.set(true);

          setTimeout(() => {
            this._authService.setToken('ey...przykladowy.token.jwt...');
            this._router.navigate(['/dashboard']);
          }, 1000);
        }, 2000); // Czas trwania rozpędzania statku
      }
    }, 2000);
  }
}
