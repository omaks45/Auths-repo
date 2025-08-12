<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Error - Page Not Found | Bluestock Fintech</title>

  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;1,600&display=swap" rel="stylesheet">

  <style>
    body {
      font-family: 'Poppins', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f8f9fa;
    }
    h3, h6, h4 {
      color: #333;
    }
    .btn-primary {
      background-color: #007bff;
      border-color: #007bff;
    }
    .btn-primary:hover {
      background-color: #0056b3;
      border-color: #0056b3;
    }
    .container {
      padding: 20px;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    @media (max-width: 768px) {
      h3 {
        font-size: 22px;
      }
      h4, h6 {
        font-size: 18px;
      }
      .btn-sm {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>

<header>
  <!-- Include your header content here -->
  <?php include_once('includes/header.php'); ?>
</header>

<div class="container text-center mt-5">
  <div class="row">
    <div class="col-md-12">
      <div class="mt-0">
        <img src="https://bluestock.in/static/assets/logo/logo.webp" class="my-4" alt="Logo">
        <img src="https://bluestock.in/static/assets/img/server-down.webp" class="my-4" alt="Logo">
        <h3>Something Went Wrong</h3>
        <h6>Sorry, We can't find the resouces you're looking for.</h6>
        <h4>Error Code 400</h4>
        <h5>From AWS Server No 6 Mumbai</h5>
      </div>

      <div class="mt-4">
        <a href="https://bluestock.in" class="btn btn-primary btn-sm px-5">Go Back</a>
      </div>
    </div>
  </div>
</div>

<footer class="mt-5">
  <!-- Include your footer content here -->
  <?php include_once('includes/footer.php'); ?>
</footer>

<!-- Bootstrap JS (Optional, if needed for other components) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>

</body>
</html>
