import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
    BehaviorSubject,
  distinctUntilChanged,
  EMPTY,
  fromEvent,
  interval,
  map,
  Observable,
  repeat,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { filter, repeatWhen, retryWhen, takeWhile, tap } from 'rxjs/operators';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
})
export class GameComponent implements OnInit {
  @ViewChild('canvasElem', { static: true }) public canvasElem: ElementRef;
  public canvas: any;
  public context: any;
  public canvasOffset: any;
  public offsetX: number;
  public offsetY: number;
  public canvasWidth: number;
  public canvasHeight: number;
  public isDragging: boolean;
  public ballImg: any;

  public mouseUp$: Observable<MouseEvent>;
  public mouseDown$: Observable<MouseEvent>;
  public mouseMove$: Observable<MouseEvent>;

  public mouseUpM$: Observable<TouchEvent>;
  public mouseDownM$: Observable<TouchEvent>;
  public mouseMoveM$: Observable<TouchEvent>;

  public score$ = new BehaviorSubject<number>(0);
  public stopSubject$ = new ReplaySubject<void>(1);

  private ballCoordinates = {
    centerX: null,
    centerY: null,
  };

  private direction:
    | 'forward'
    | 'back'
    | 'left-bottom'
    | 'right_bottom'
    | 'right_top'
    | 'left_top' = 'forward';
  private stopCountSubject$ = new Subject<void>();
  private readonly start$ = new Subject<void>();

  constructor() {}

  ngOnInit() {
    this.canvas = this.canvasElem.nativeElement;
    this.context = this.canvas.getContext('2d');

    this.mouseUp$ = fromEvent<MouseEvent>(
      this.canvasElem.nativeElement,
      'mouseup'
    );
    this.mouseDown$ = fromEvent<MouseEvent>(
      this.canvasElem.nativeElement,
      'mousedown'
    );
    this.mouseMove$ = fromEvent<MouseEvent>(
      this.canvasElem.nativeElement,
      'mousemove'
    );

    this.mouseUpM$ = fromEvent<TouchEvent>(
      this.canvasElem.nativeElement,
      'touchstart'
    );
    this.mouseDownM$ = fromEvent<TouchEvent>(
      this.canvasElem.nativeElement,
      'touchend'
    );
    this.mouseMoveM$ = fromEvent<TouchEvent>(
      this.canvasElem.nativeElement,
      'touchmove'
    );

    this.offsetX = this.canvas.offsetLeft;
    this.offsetY = this.canvas.offsetTop;
    this.canvasWidth = this.canvas.width;
    this.canvasHeight = this.canvas.height;
    this.isDragging = false;

    const url =
      'https://media.istockphoto.com/vectors/soccer-football-pitch-with-stripe-design-vector-id165081013?k=20&m=165081013&s=612x612&w=0&h=974ABI6lYrtssvH_UuNPcZDPiGIreQ6N5v2fuGnnt_E=';
    const playerUrl =
      'https://play-lh.googleusercontent.com/EaknoLfqDKwQFlbM06zSQmp2uWIUcQ_lWcnO0X7ORk0H2Dx45PmuKAtdI7Ai8-UBGmg';
    // 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBgBhO2ET6Gw4b8ahZFSgJE_IbRil-Ba8HkA&usqp=CAU';
    const image = new Image();
    const player = new Image(50, 50);

    this.ballImg = new Image(50, 50);

    this.ballImg.src =
      'https://cdn1.iconfinder.com/data/icons/education-259/100/education-19-512.png';

    image.src = url;
    player.src = playerUrl;
    const images = [image, player, this.ballImg];
    image.onload =
      player.onload =
      this.ballImg.onload =
        () => {
          this._generateGameFiled(images);
        };

    requestAnimationFrame(this._updateView.bind(this, images));
  }

  private _generateGameFiled(images: any[]): void {
    this.canvas.width = images[0].width;
    this.canvas.height = images[0].height;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.ballCoordinates = {
      centerX,
      centerY,
    };

    this.context.drawImage(images[0], 0, 0, images[0].width, images[0].height);
    this.context.drawImage(images[1], 169.5, 522, 80, 80);
    this._drawBall(
      this.ballCoordinates.centerX,
      this.ballCoordinates.centerY,
      images[2]
    );
    this._drawGoal();
  }

  private _updateView(images: any[0]): void {
    let offset;
    const isMobile = this._detectMob();
    // console.log(isMobile);
    const source$: Observable<any> = !isMobile
      ? this.mouseDown$.pipe(
          switchMap(() => this.mouseMove$.pipe(takeUntil(this.mouseUp$))),
          map(({ clientX, clientY }) => {
            return { clientX, clientY };
          })
        )
      : this.mouseMoveM$.pipe(
          map(({ touches }) => {
            return { clientX: touches[0].clientX, clientY: touches[0].clientY };
          })
        );

    source$
      .pipe(
        // tap(() => this.start$.next()),
        distinctUntilChanged((a, b) => a.clientX === b.clientX),
        distinctUntilChanged((a, b) => a.clientY === b.clientY),
        tap(({ clientX, clientY }) => {
          const canMouseX = clientX - this.offsetX;
          const canMouseY = clientY - this.offsetY;

          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

          this.context.drawImage(
            images[0],
            0,
            0,
            images[0].width,
            images[0].height
          );
          this.context.drawImage(
            images[1],
            canMouseX - 80 / 2,
            canMouseY - 80 / 2,
            80,
            80
          );
          this._drawGoal();
        }),
        switchMap(({ clientX, clientY }) => {
          //console.log('X: ', clientX, 'Y: ', clientX);
          const centerX = this.canvas.width / 2;
          const centerY = this.canvas.height / 2;

          if (this.calculateCickPossibility(clientX, clientY)) {
            let count = 5;
            offset = 1;

            return interval(100).pipe(
              map(() => count--),
              takeWhile((res) => res > 0),
              takeUntil(this.stopCountSubject$),
              map(() => ({ clientX, clientY }))
              // retryWhen(() => this.start$)
            );
          } else {
            this._drawBall(
              this.ballCoordinates.centerX,
              this.ballCoordinates.centerY,
              this.ballImg
            );
            this._drawGoal();

            return EMPTY;
          }
        }),
        repeat()
      )
      .subscribe(({ clientX, clientY }) => {
        const canMouseX = clientX - this.offsetX;
        const canMouseY = clientY - this.offsetY;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // console.log('X1: ', canMouseX, 'Y1: ', canMouseY);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(
          images[0],
          0,
          0,
          images[0].width,
          images[0].height
        );

        this.context.drawImage(
          images[1],
          canMouseX - 80 / 2,
          canMouseY - 80 / 2,
          80,
          80
        );
        this._drawGoal();

        let y;
        let x;

        console.log(this.direction);

        if (this.direction === 'forward') {
          y = this.ballCoordinates.centerY - offset * 15;
          x = this.ballCoordinates.centerX;
        }

        if (this.direction === 'back') {
          y = this.ballCoordinates.centerY + offset * 15;
          x = this.ballCoordinates.centerX;
        }

        if (this.direction === 'left-bottom') {
          x = this.ballCoordinates.centerX + offset * 15;
          y = Math.abs(this.ballCoordinates.centerY - 15 * offset);
        }

        if (this.direction === 'right_bottom') {
          x = this.ballCoordinates.centerX - offset * 15;
          y = Math.abs(this.ballCoordinates.centerY - 15 * offset);
        }

        if (this.direction === 'left_top') {
          x = this.ballCoordinates.centerX + offset * 15;
          y = Math.abs(this.ballCoordinates.centerY + 15 * offset);
        }

        if (this.direction === 'right_top') {
          x = this.ballCoordinates.centerX - offset * 15;
          y = Math.abs(this.ballCoordinates.centerY + 15 * offset);
        }

        if (x <= 25 && this.direction === 'right_bottom') {
          x = this.ballCoordinates.centerX + offset * 15;
          y = Math.abs(this.ballCoordinates.centerY - 15 * offset);
        }

        if (x <= 25 && this.direction === 'right_top') {
          x = this.ballCoordinates.centerX + offset * 15;
          y = Math.abs(this.ballCoordinates.centerY + 15 * offset);
        }

        if (x >= 404 && this.direction === 'left-bottom') {
          x = this.ballCoordinates.centerX - offset * 15;
          y = Math.abs(this.ballCoordinates.centerY - 15 * offset);
        }

        if (x >= 404 && this.direction === 'left_top') {
          x = this.ballCoordinates.centerX - offset * 15;
          y = Math.abs(this.ballCoordinates.centerY + 15 * offset);
        }

        if ((y <= 25 && x < 129.5) || (y <= 25 && x > 289.5)) {
          y = this.ballCoordinates.centerY + offset * 15;
          x = this.ballCoordinates.centerX;
        }

        if (y <= 25 && x >= 129.5 && x <= 289.5) {
          this.stopCountSubject$.next();

          setTimeout(() => {
            console.log('Goal!!!!!');
            //alert('goal!!!!!');
            this.context.font = '48px serif';
            this.context.strokeText(
              'Goal!!!!!',
              this.canvas.width / 2 - 60,
              this.canvas.height / 2
            );
            this.score$.next(this.score$.getValue() + 1);

            setTimeout(() => {
              x = this.canvas.width / 2;
              y = this.canvas.height / 2;
              this.context.clearRect(
                0,
                0,
                this.canvas.width,
                this.canvas.height
              );

              this.context.drawImage(
                images[0],
                0,
                0,
                images[0].width,
                images[0].height
              );

              this.context.drawImage(
                images[1],
                canMouseX - 80 / 2,
                canMouseY - 80 / 2,
                80,
                80
              );
              this._drawBall(x, y, this.ballImg);
              this._drawGoal();
            }, 1500);
          }, 0);
        }

        if (y >= 587) {
          y = this.ballCoordinates.centerY - offset * 15;
          x = this.ballCoordinates.centerX;
        }
        console.log('x', x, 'y', y);

        this._drawBall(x, y, this.ballImg);

        //console.log(this.ballCoordinates);
        if (
          this.ballCoordinates.centerY - 50 / 2 <= 25 ||
          this.ballCoordinates.centerY === 587
        ) {
          this.stopCountSubject$.next();
        }

        offset++;
      });
  }

  private _drawBall(centerX, centerY, img): void {
    const radius = 30;
    // console.log(centerX, centerY);

    this.ballCoordinates = {
      centerX,
      centerY,
    };

    this.context.drawImage(
      img,
      this.ballCoordinates.centerX - 50 / 2,
      this.ballCoordinates.centerY - 50 / 2,
      50,
      50
    );

    /*this.context.beginPath();
    this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    this.context.fillStyle = 'orange';
    this.context.fill();
    this.context.lineWidth = 2;
    this.context.strokeStyle = '#003300';
    this.context.stroke();*/
  }

  private _drawGoal(): void {
    for (let i = 0; i < 5; i++) {
      this.context.beginPath();
      this.context.moveTo(129.5, i * 10);
      this.context.lineTo(289.5, i * 10);
      this.context.strokeStyle = 'red';
      this.context.lineWidth = 2;
      this.context.stroke();
    }

    this.context.beginPath();
    this.context.moveTo(129.5, 0);
    this.context.lineTo(129.5, 45);
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 4;
    this.context.stroke();

    this.context.beginPath();
    this.context.moveTo(289.5, 0);
    this.context.lineTo(289.5, 45);
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 4;
    this.context.stroke();

    for (let i = 0; i < 16; i++) {
      this.context.beginPath();
      this.context.moveTo(135 + i * 10, 0);
      this.context.lineTo(135 + i * 10, 45);
      this.context.strokeStyle = 'red';
      this.context.lineWidth = 2;
      this.context.stroke();
    }
  }

  private _detectMob() {
    const toMatch = [
      /Android/i,
      /webOS/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i,
    ];

    return toMatch.some((toMatchItem) => {
      return navigator.userAgent.match(toMatchItem);
    });
  }

  private calculateCickPossibility(clientX: number, clientY: number): boolean {
    const { centerX, centerY } = this.ballCoordinates;

    if (
      Math.abs(clientX - this.offsetX - centerX) <= 30 &&
      clientY - this.offsetY >= centerY
    ) {
      this.direction = 'forward';
      // console.log('target, ', clientX - this.offsetX - centerX);

      return (
        Math.abs(clientX - this.offsetX - centerX) <= 30 &&
        clientY - this.offsetY - 80 / 2 <= centerY + 50 / 2
      );

      // forward
    }

    if (
      Math.abs(clientX - this.offsetX - centerX) <= 30 &&
      clientY - this.offsetY <= centerY
    ) {
      this.direction = 'back';

      return (
        Math.abs(clientX - this.offsetX - centerX) <= 30 &&
        clientY - this.offsetY + 80 / 2 >= centerY - 50 / 2
      );

      // back
    }

    if (clientX - this.offsetX < centerX && clientY - this.offsetY > centerY) {
      //  console.log('X: ', clientX, 'Y: ', clientY);
      this.direction = 'left-bottom';

      return (
        clientX - this.offsetX + 80 / 2 >= centerX - 50 / 2 &&
        clientY - this.offsetY - 80 / 2 <= centerY + 50 / 2
      );

      // left bottom
    }

    if (clientX - this.offsetX > centerX && clientY - this.offsetY > centerY) {
      this.direction = 'right_bottom';

      return (
        clientX - this.offsetX - 80 / 2 < centerX + 50 / 2 &&
        clientY - this.offsetY - 80 / 2 <= centerY + 50 / 2
      );

      // right bottom
    }

    if (clientX - this.offsetX < centerX && clientY - this.offsetY < centerY) {
      this.direction = 'left_top';

      const { centerX, centerY } = this.ballCoordinates;

      return (
        clientX - this.offsetX + 80 / 2 >= centerX - 50 / 2 &&
        clientY - this.offsetY + 80 / 2 > centerY - 50 / 2
      );

      // left top
    }

    if (clientX - this.offsetX > centerX && clientY - this.offsetY < centerY) {
      const { centerX, centerY } = this.ballCoordinates;
      this.direction = 'right_top';

      return (
        clientX - this.offsetX - 80 / 2 < centerX + 50 / 2 &&
        clientY - this.offsetY + 80 / 2 > centerY - 50 / 2
      );

      // right top
    }

    return false;
  }
}
