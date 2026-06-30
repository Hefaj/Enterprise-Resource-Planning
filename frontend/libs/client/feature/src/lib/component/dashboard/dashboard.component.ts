import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { required, email, min } from '@angular/forms/signals';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { ErpInputTextBuilder, ErpInputTextComponent } from '@erp/shared/ui';

@Component({
  selector: 'erp-dashboard',
  standalone: true,
  imports: [CommonModule, CheckboxModule, InputTextModule, ButtonModule, ErpInputTextComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  public myDynamicForm = new FormGroup({
    email: new SignalFormControl('jan@example.com', (p) => {
      required(p);
      email(p);
    }),
    age: new SignalFormControl(30, (p) => {
      required(p);
      min(p, 5);
    }),
  });

  public control = this.myDynamicForm.controls.email;

  public textConfig = ErpInputTextBuilder.create((input) => {
    input.setPlaceholder('Rafi');
    input.setErrorMessages({
      required: 'required',
      email: 'email',
    });
  });

  public control2 = this.myDynamicForm.controls.age;

  public textConfig2 = ErpInputTextBuilder.create((input) => {
    input.setPlaceholder('Rafi2');
    input.setHint('Ale jazda2');
    input.setErrorMessages({
      required: 'required',
      min: 'min',
    });
  });
}
