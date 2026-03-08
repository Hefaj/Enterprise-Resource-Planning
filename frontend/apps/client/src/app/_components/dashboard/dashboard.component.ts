import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { EInputTextBuilder, EInputTextComponent, ETwoSectionLayoutComponent } from '@erp/shared/ui';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CheckboxModule,
    InputTextModule,
    ButtonModule,
    EInputTextComponent,
    ETwoSectionLayoutComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  public myDynamicForm = new FormGroup({
    email: new FormControl('jan@example.com', [Validators.required, Validators.email]),
    age: new FormControl(30, [Validators.required, Validators.minLength(5)]),
  });

  public control = this.myDynamicForm.controls.email;

  public textConfig = EInputTextBuilder.create((input) => {
    input.setPlaceholser('Rafi');
    input.setErrorMessages({
      required: 'required',
      email: 'email',
    });
  });

  public control2 = this.myDynamicForm.controls.age;

  public textConfig2 = EInputTextBuilder.create((input) => {
    input.setPlaceholser('Rafi2');
    input.setHint('Ale jazda2');
    input.setErrorMessages({
      required: 'required',
      min: 'min',
    });
  });
}
