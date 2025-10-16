from django.db import models
from django.contrib import admin
from .models import Location, TestArea

# Register your models here.
admin.site.register(Location)
admin.site.register(TestArea)