import {ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import * as RecordRTC from 'recordrtc';
import tus from 'tus-js-client';
import {ToastController} from '@ionic/angular';
import {environment} from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage {
  recording = false;
  uploadProgress = 0;
  @ViewChild('videoElement', {static: true}) videoElement;
  private recordRTC: RecordRTC;

  constructor(private readonly toastCtrl: ToastController,
              private readonly changeDetectionRef: ChangeDetectorRef) {
  }

  start() {
    this.recording = true;
    navigator.mediaDevices.getUserMedia({video: true, audio: false})
      .then(async (stream) => {
        this.videoElement.nativeElement.srcObject = stream;
        await this.videoElement.nativeElement.play();

        this.recordRTC = RecordRTC(stream, {type: 'video'});
        this.recordRTC.startRecording();

      })
      .catch(err => console.log('An error occurred! ' + err));
  }

  stop() {
    this.recording = false;
    if (this.recordRTC) {
      this.recordRTC.stopRecording(_ => {
        const recordedBlob = this.recordRTC.getBlob();
        this.uploadVideo(recordedBlob);
      });
    }

    this.videoElement.nativeElement.pause();
    this.videoElement.nativeElement.srcObject = null;
  }

  takeSnapshot() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 960;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement.nativeElement, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(this.uploadSnapshot.bind(this), 'image/jpeg', 1);
  }

  private uploadVideo(blob: Blob) {
    const f = new File([blob], `video_${Date.now()}.webm`, {
      type: 'video/webm'
    });

    this.uploadFile(f);
  }

  private uploadSnapshot(blob: Blob) {
    const f = new File([blob], `snapshot_${Date.now()}.jpg`, {
      type: 'image/jpeg'
    });

    this.uploadFile(f);
  }

  private uploadFile(file: File) {
    this.uploadProgress = 0;

    const upload = new tus.Upload(file, {
      endpoint: `${environment.serverURL}/upload`,
      retryDelays: [0, 3000, 6000, 12000, 24000],
      chunkSize: 20000,
      metadata: {
        filename: file.name,
        filetype: file.type
      },
      onError: async (error) => {
        const toast = await this.toastCtrl.create({
          message: 'Upload failed: ' + error,
          duration: 3000,
          position: 'top'
        });
        toast.present();
      },
      onChunkComplete: (chunkSize, bytesAccepted, bytesTotal) => {
        this.uploadProgress = Math.floor(bytesAccepted / bytesTotal * 100);
        this.changeDetectionRef.detectChanges();
      },
      onSuccess: async () => {
        this.uploadProgress = 100;
        this.changeDetectionRef.detectChanges();
        const toast = await this.toastCtrl.create({
          message: 'Upload successful',
          duration: 3000,
          position: 'top',
        });
        toast.present();
      }
    });

    upload.start();
  }
}