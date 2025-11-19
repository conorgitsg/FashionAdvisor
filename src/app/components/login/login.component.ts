import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private router: Router) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please enter both email and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Simulate login - replace with actual authentication
    setTimeout(() => {
      // For demo purposes, accept any valid email format
      if (this.email.includes('@')) {
        localStorage.setItem('userEmail', this.email);
        localStorage.setItem('isLoggedIn', 'true');
        this.router.navigate(['/inventory']);
      } else {
        this.errorMessage.set('Please enter a valid email address');
      }
      this.isLoading.set(false);
    }, 1000);
  }

  forgotPassword(): void {
    if (this.email) {
      alert(`Password reset link would be sent to ${this.email}`);
    } else {
      alert('Please enter your email address first');
    }
  }
}
