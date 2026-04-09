$(document).ready(function () {
  var slider = $('.product-slider');

  if (!slider.length) {
    return;
  }

  slider.not('.slick-initialized').slick({
    slidesToShow: 3,
    slidesToScroll: 1,
    arrows: true,
    dots: false,
    infinite: true,
    adaptiveHeight: false,
    autoplay: false,
    speed: 420,
    cssEase: 'ease',
    responsive: [
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 2,
        }
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
        }
      }
    ]
  });
});